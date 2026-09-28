// Cloudflare Workers adapter. Everything platform-specific lives here: routing,
// CORS, reading the request, identity verification, logging and turning results
// or errors into Responses. Business logic lives in ./handlers.
import { createEmailSender } from './core/email.js'
import { createTextGenerator } from './core/genai.js'
import { ApiError, invalidRequest, notFound } from './core/errors.js'
import { createFirestore } from './core/firestore.js'
import { createMapServices } from './core/maps.js'
import { bearerToken, verifyIdToken } from './core/idToken.js'
import { getAccessToken, parseServiceAccount } from './core/serviceAccount.js'
import { validateBody } from './core/validate.js'
import { me } from './handlers/me.js'
import { cancelRegistration, cancelSchema, register, registerSchema } from './handlers/registrations.js'
import { emailRoster, rosterEmailSchema } from './handlers/rosterEmail.js'
import { aiDraft, aiDraftSchema } from './handlers/aiDraft.js'
import { getPublicEvent, listPublicEvents, rateLimited } from './handlers/publicEvents.js'
import { createRateLimiter, findApiKey, parseApiKeys } from './public/apiKeys.js'
import { openApiDocument } from './public/openapi.js'
import {
  geoDirections,
  geoDirectionsSchema,
  geoNearby,
  geoNearbySchema,
  geoSearch,
  geoSearchSchema,
} from './handlers/geo.js'
import {
  EMAIL_REGISTRANTS_MAX_BODY_BYTES,
  emailRegistrants,
  emailRegistrantsSchema,
} from './handlers/emailRegistrants.js'

const DEFAULT_MAX_BODY_BYTES = 16 * 1024

// Each route declares whether it needs a signed-in caller and, for requests
// with a body, the schema that body must match.
const ROUTES = {
  'GET /me': { handler: me, auth: true },
  'POST /registrations': { handler: register, auth: true, schema: registerSchema },
  'POST /registrations/cancel': { handler: cancelRegistration, auth: true, schema: cancelSchema },
  'POST /events/roster-email': { handler: emailRoster, auth: true, schema: rosterEmailSchema },
  'POST /events/email-registrants': {
    handler: emailRegistrants,
    auth: true,
    schema: emailRegistrantsSchema,
    maxBodyBytes: EMAIL_REGISTRANTS_MAX_BODY_BYTES,
  },
  'POST /geo/search': { handler: geoSearch, auth: true, schema: geoSearchSchema },
  'POST /geo/directions': { handler: geoDirections, auth: true, schema: geoDirectionsSchema },
  'POST /geo/nearby': { handler: geoNearby, auth: true, schema: geoNearbySchema },
  'POST /ai/draft': { handler: aiDraft, auth: true, schema: aiDraftSchema },
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin')
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  return origin && allowed.includes(origin) ? origin : null
}

// Origins not on the allowlist get no CORS headers at all, so browsers on other
// sites can't read responses. (CORS is not authentication - the ID token is.)
function corsHeaders(origin) {
  if (!origin) {
    return { Vary: 'Origin' }
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(origin),
    },
  })
}

async function readBody(request, route) {
  if (!route.schema) {
    return undefined
  }
  const maxBytes = route.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  const text = await request.text()
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request is too large.')
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw invalidRequest('Request body must be valid JSON.')
  }
  return validateBody(route.schema, parsed)
}

let serviceAccount = null
function buildDeps(env) {
  return {
    firestore: createFirestore({
      projectId: env.FIREBASE_PROJECT_ID,
      getToken: () => {
        serviceAccount ??= parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT)
        return getAccessToken(serviceAccount)
      },
    }),
    email: createEmailSender({ apiKey: env.BREVO_API_KEY, senderEmail: env.BREVO_SENDER_EMAIL }),
    maps: createMapServices({ orsApiKey: env.ORS_API_KEY, userAgent: env.NOMINATIM_USER_AGENT }),
    ai: createTextGenerator({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }),
  }
}

// One structured line per request. Deliberately no emails, names or request
// bodies - only what's needed to debug and measure.
function log(entry) {
  console.log(JSON.stringify(entry))
}

// --- Public API (/public/v1/...) --------------------------------------------
// Read-only, for other sites and apps. Unlike the app's own API it is open to
// any origin (it's meant to be called from elsewhere), and callers identify
// themselves with an API key instead of a Firebase sign-in.

const PUBLIC_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'X-API-Key',
  'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Remaining',
  'Access-Control-Max-Age': '86400',
}
const publicLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 })
let publicKeys = { secret: null, keys: [] }

function apiKeysFrom(env) {
  if (publicKeys.secret !== env.PUBLIC_API_KEYS) {
    publicKeys = { secret: env.PUBLIC_API_KEYS, keys: parseApiKeys(env.PUBLIC_API_KEYS) }
  }
  return publicKeys.keys
}

function publicJson(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...PUBLIC_CORS,
      ...headers,
    },
  })
}

const EVENTS_PATH = /^\/public\/v1\/events(?:\/([^/]+))?\/?$/

async function handlePublic(request, env, url) {
  const started = Date.now()
  const endpoint = `${request.method} ${url.pathname}`
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: PUBLIC_CORS })
  }

  let caller = null
  let status
  let outcome
  let response
  const headers = {}
  try {
    if (request.method !== 'GET') {
      throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'The public API is read-only; use GET.')
    }
    let result
    if (url.pathname === '/public/v1/openapi.json') {
      result = openApiDocument(url.origin)
    } else {
      const presented = request.headers.get('X-API-Key')
      if (!presented) {
        throw new ApiError(401, 'API_KEY_MISSING', 'Send your API key in the X-API-Key header.')
      }
      caller = findApiKey(apiKeysFrom(env), presented)
      if (!caller) {
        throw new ApiError(401, 'API_KEY_INVALID', 'That API key is not valid.')
      }
      const limit = publicLimiter.check(caller)
      headers['X-RateLimit-Remaining'] = String(limit.remaining)
      if (!limit.allowed) throw rateLimited(limit.retryAfterSeconds)

      const match = EVENTS_PATH.exec(url.pathname)
      if (!match) throw notFound('No such endpoint. See /public/v1/openapi.json.')
      const deps = buildDeps(env)
      const siteUrl = env.PUBLIC_SITE_URL
      if (match[1]) {
        let id
        try {
          id = decodeURIComponent(match[1])
        } catch {
          throw notFound('No event with that id.')
        }
        result = await getPublicEvent({ id, deps, siteUrl })
      } else {
        result = await listPublicEvents({ searchParams: url.searchParams, deps, siteUrl })
      }
    }
    status = 200
    outcome = 'ok'
    // Per key, since responses are only for key holders.
    response = publicJson(status, result, { ...headers, 'Cache-Control': 'public, max-age=60', Vary: 'X-API-Key' })
  } catch (error) {
    if (error instanceof ApiError) {
      status = error.status
      outcome = error.code
      if (error.retryAfterSeconds) headers['Retry-After'] = String(error.retryAfterSeconds)
      response = publicJson(status, { error: { code: error.code, message: error.message } }, headers)
    } else {
      status = 500
      outcome = 'INTERNAL'
      response = publicJson(status, { error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } })
      log({ level: 'error', endpoint, apiKey: caller, error: error?.message, upstreamStatus: error?.upstreamStatus })
    }
  }
  // The key's name is logged, never the key.
  log({ level: 'info', endpoint, apiKey: caller, status, outcome, durationMs: Date.now() - started })
  return response
}

export default {
  async fetch(request, env) {
    const started = Date.now()
    const url = new URL(request.url)
    if (url.pathname.startsWith('/public/')) {
      return handlePublic(request, env, url)
    }
    const origin = allowedOrigin(request, env)
    const endpoint = `${request.method} ${url.pathname}`
    let uid = null

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    let status
    let outcome
    let response
    try {
      const route = ROUTES[endpoint]
      if (!route) {
        throw notFound('No such endpoint.')
      }

      const user = route.auth ? await verifyIdToken(bearerToken(request), env.FIREBASE_PROJECT_ID) : null
      uid = user?.uid ?? null
      const body = await readBody(request, route)
      const result = await route.handler({ user, body, deps: buildDeps(env) })

      status = 200
      outcome = 'ok'
      response = json(status, result, origin)
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.status
        outcome = error.code
        response = json(status, { error: { code: error.code, message: error.message } }, origin)
      } else {
        status = 500
        outcome = 'INTERNAL'
        response = json(
          status,
          { error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } },
          origin,
        )
      }
      if (status >= 500) {
        log({
          level: 'error',
          endpoint,
          uid,
          error: error?.message,
          upstreamStatus: error?.upstreamStatus,
          upstreamDetail: error?.upstreamDetail,
        })
      }
    }

    log({ level: 'info', endpoint, uid, status, outcome, durationMs: Date.now() - started })
    return response
  },
}
