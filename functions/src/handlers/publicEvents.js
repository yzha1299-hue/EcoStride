import { ApiError, invalidRequest, notFound } from '../core/errors.js'
import { createMemoryCache } from '../core/memoryCache.js'
import { toPublicEvent } from '../public/publicEvent.js'

// Read-only public API for partners (councils, community sites) to list
// EcoStride's upcoming events. Every event goes through toPublicEvent, so no
// personal data can be returned. Results are cached for a minute: partners
// polling the API cost at most one Firestore query per minute per isolate.
const CACHE_MS = 60_000
const cache = createMemoryCache({ ttlMs: CACHE_MS, maxEntries: 200 })

const MAX_LIMIT = 50
const DEFAULT_LIMIT = 20
const ID_PATTERN = /^[\w-]{1,128}$/

async function upcomingEvents(firestore, now) {
  const cached = cache.get('upcoming')
  if (cached) return cached
  // Not yet finished; cancelled ones are included so partners can take them down.
  const events = await firestore.runQuery({
    from: [{ collectionId: 'events' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'endsAt' },
        op: 'GREATER_THAN_OR_EQUAL',
        value: { timestampValue: now.toISOString() },
      },
    },
  })
  cache.set('upcoming', events)
  return events
}

// Query string -> { type, limit }. Unknown parameters are rejected so typos
// ("limt=5") fail loudly instead of being silently ignored.
export function parseListQuery(searchParams) {
  for (const key of searchParams.keys()) {
    if (key !== 'type' && key !== 'limit') throw invalidRequest(`Unknown query parameter: ${key}.`)
  }
  const type = searchParams.get('type')?.trim() || null
  if (type && type.length > 60) throw invalidRequest('type must be at most 60 characters.')
  let limit = DEFAULT_LIMIT
  if (searchParams.has('limit')) {
    limit = Number(searchParams.get('limit'))
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw invalidRequest(`limit must be a whole number from 1 to ${MAX_LIMIT}.`)
    }
  }
  return { type, limit }
}

export async function listPublicEvents({ searchParams, deps, siteUrl, now = new Date() }) {
  const { type, limit } = parseListQuery(searchParams)
  const events = (await upcomingEvents(deps.firestore, now))
    .filter(({ data }) => !type || data.type?.toLowerCase() === type.toLowerCase())
    .sort((a, b) => a.data.startsAt - b.data.startsAt)
  const page = events.slice(0, limit).map(({ id, data }) => toPublicEvent(id, data, { now, siteUrl }))
  return { data: page, count: page.length, total: events.length, generatedAt: now.toISOString() }
}

export async function getPublicEvent({ id, deps, siteUrl, now = new Date() }) {
  if (!ID_PATTERN.test(id)) throw notFound('No event with that id.')
  let doc = cache.get(`event:${id}`)
  if (doc === undefined) {
    doc = await deps.firestore.getDocument(`events/${id}`)
    cache.set(`event:${id}`, doc)
  }
  if (!doc) throw notFound('No event with that id.')
  return { data: toPublicEvent(doc.id, doc.data, { now, siteUrl }), generatedAt: now.toISOString() }
}

export const rateLimited = (retryAfterSeconds) => {
  const error = new ApiError(429, 'RATE_LIMITED', `Too many requests. Try again in ${retryAfterSeconds} seconds.`)
  error.retryAfterSeconds = retryAfterSeconds
  return error
}
