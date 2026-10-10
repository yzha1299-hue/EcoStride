import { ApiError, notFound } from '../core/errors.js'
import { getPublicEvent, listPublicEvents, rateLimited } from '../handlers/publicEvents.js'
import { createRateLimiter, findApiKey, parseApiKeys } from './apiKeys.js'
import { openApiDocument } from './openapi.js'

// The public, read-only API (/api/public/v1/...). Unlike the app's own API it
// is open to any origin (it is meant to be called from other sites) and
// callers identify themselves with an API key instead of a Firebase sign-in.
const PUBLIC_PREFIX = '/api/public/'
const EVENTS_PATH = /^\/public\/v1\/events(?:\/([^/]+))?\/?$/

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-API-Key',
  'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Remaining',
  'Access-Control-Max-Age': '86400',
}

export const isPublicRequest = (req) => req.path.startsWith(PUBLIC_PREFIX)

// The address the caller used, so the OpenAPI document points back at it.
// Behind Firebase Hosting that is in the forwarded headers.
function requestOrigin(req) {
  const protocol = req.get('X-Forwarded-Proto')?.split(',')[0].trim() || req.protocol
  const host = req.get('X-Forwarded-Host')?.split(',')[0].trim() || req.get('Host')
  return `${protocol}://${host}`
}

// `keys()`: the PUBLIC_API_KEYS secret; `siteUrl()`: where events link to;
// `db()`: Firestore; `log`: one structured entry per request, with the key's
// name but never the key.
export function createPublicApi({
  keys,
  siteUrl,
  db,
  log,
  limiter = createRateLimiter({ limit: 60, windowMs: 60_000 }),
}) {
  let parsed = { secret: null, keys: [] }
  function apiKeys() {
    const secret = keys()
    if (parsed.secret !== secret) parsed = { secret, keys: parseApiKeys(secret) }
    return parsed.keys
  }

  function send(res, status, body, headers) {
    res.set({ 'X-Content-Type-Options': 'nosniff', ...CORS, ...headers })
    res.status(status).json(body)
  }

  return async function handle(req, res) {
    const started = Date.now()
    const endpoint = `${req.method} ${req.path}`
    if (req.method === 'OPTIONS') {
      res.set(CORS)
      res.status(204).end()
      return
    }

    let caller = null
    let status
    let outcome
    const headers = {}
    try {
      if (req.method !== 'GET') {
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'The public API is read-only; use GET.')
      }
      const path = req.path.replace(/^\/api/, '')
      let result
      if (path === '/public/v1/openapi.json') {
        result = openApiDocument(`${requestOrigin(req)}/api`)
      } else {
        const presented = req.get('X-API-Key')
        if (!presented) {
          throw new ApiError(401, 'API_KEY_MISSING', 'Send your API key in the X-API-Key header.')
        }
        caller = findApiKey(apiKeys(), presented)
        if (!caller) {
          throw new ApiError(401, 'API_KEY_INVALID', 'That API key is not valid.')
        }
        const limit = limiter.check(caller)
        headers['X-RateLimit-Remaining'] = String(limit.remaining)
        if (!limit.allowed) throw rateLimited(limit.retryAfterSeconds)

        const match = EVENTS_PATH.exec(path)
        if (!match) throw notFound('No such endpoint. See /public/v1/openapi.json.')
        const deps = { db: db() }
        if (match[1]) {
          let id
          try {
            id = decodeURIComponent(match[1])
          } catch {
            throw notFound('No event with that id.')
          }
          result = await getPublicEvent({ id, deps, siteUrl: siteUrl() })
        } else {
          const { searchParams } = new URL(req.url, 'http://localhost')
          result = await listPublicEvents({ searchParams, deps, siteUrl: siteUrl() })
        }
      }
      status = 200
      outcome = 'ok'
      // `private` keeps Firebase Hosting's CDN from serving one key holder's
      // response to another; the caller's own browser may still reuse it.
      send(res, status, result, { ...headers, 'Cache-Control': 'private, max-age=60', Vary: 'X-API-Key' })
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.status
        outcome = error.code
        if (error.retryAfterSeconds) headers['Retry-After'] = String(error.retryAfterSeconds)
        send(res, status, { error: { code: error.code, message: error.message } }, { ...headers, 'Cache-Control': 'no-store' })
      } else {
        status = 500
        outcome = 'INTERNAL'
        send(
          res,
          status,
          { error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } },
          { 'Cache-Control': 'no-store' },
        )
        log('error', { endpoint, apiKey: caller, error: error?.message, upstreamStatus: error?.upstreamStatus })
      }
    }
    log('info', { endpoint, apiKey: caller, status, outcome, durationMs: Date.now() - started })
  }
}
