import { ApiError, invalidRequest, notFound } from './core/errors.js'
import { verifyCaller } from './core/identity.js'
import { validateBody } from './core/validate.js'

// Turns the platform's request/response (Cloud Functions' Express-style req
// and res) into calls to plain handlers: { user, body, deps } -> result.
// Everything about HTTP lives here - routing, body limits, identity, the error
// shape and logging - so the handlers stay platform-agnostic.
//
// The API is served on the site's own origin through a Hosting rewrite of
// /api/**, so requests arrive as /api/<route>; the prefix is stripped before
// routing. Same-origin means no CORS headers are sent: a browser on another
// site can't read these responses.
const DEFAULT_MAX_BODY_BYTES = 16 * 1024

function routeKey(req) {
  const path = req.path.replace(/^\/api(?=\/|$)/, '') || '/'
  return `${req.method} ${path.replace(/\/$/, '') || '/'}`
}

function readBody(req, route) {
  if (!route.schema) {
    return undefined
  }
  const raw = req.rawBody ?? Buffer.alloc(0)
  if (raw.length > (route.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES)) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.')
  }
  let parsed
  try {
    parsed = JSON.parse(raw.toString('utf8'))
  } catch {
    throw invalidRequest('Request body must be valid JSON.')
  }
  return validateBody(route.schema, parsed)
}

function send(res, status, body) {
  res.set('Cache-Control', 'no-store')
  res.set('X-Content-Type-Options', 'nosniff')
  res.status(status).json(body)
}

// `routes`: { 'GET /me': { handler, auth, schema?, maxBodyBytes? } }
// `deps()`: what handlers get (Firestore, email, maps, ...), built per request.
// `log`: one structured entry per request - never emails, names or bodies.
export function createApi({ routes, deps, auth, log }) {
  return async function handle(req, res) {
    const started = Date.now()
    const endpoint = routeKey(req)
    let uid = null
    let status
    let outcome
    try {
      const route = routes[endpoint]
      if (!route) {
        throw notFound('No such endpoint.')
      }
      const user = route.auth ? await verifyCaller(auth(), req.get('Authorization')) : null
      uid = user?.uid ?? null
      const body = readBody(req, route)
      const result = await route.handler({ user, body, deps: deps() })
      status = 200
      outcome = 'ok'
      send(res, status, result)
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.status
        outcome = error.code
        send(res, status, { error: { code: error.code, message: error.message } })
      } else {
        status = 500
        outcome = 'INTERNAL'
        send(res, status, { error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } })
      }
      if (status >= 500) {
        log('error', {
          endpoint,
          uid,
          error: error?.message,
          upstreamStatus: error?.upstreamStatus,
          upstreamDetail: error?.upstreamDetail,
        })
      }
    }
    log('info', { endpoint, uid, status, outcome, durationMs: Date.now() - started })
  }
}
