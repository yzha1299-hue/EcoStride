import { beforeAll, describe, expect, it } from 'vitest'
import { PUBLIC_EVENT_FIELDS } from '../../functions/src/public/publicEvent.js'
import { api, db, resetEmulators, seedEvent, signedInUser } from './apiEnv'

// The public API (/api/public/v1/...), through the real API function on the
// emulators. scripts/test-api.mjs gives the function two test keys: "demo" and
// "burst" (kept for the rate-limit test, which uses up its minute's allowance).
//
// The function keeps the upcoming-events list for a minute, so the events are
// stored once, up front, and the tests below share them.
const DEMO = { 'X-API-Key': 'demo-test-key' }
const publicGet = (path, headers = DEMO) => api(`/public/v1${path}`, { headers })

const HOUR = 60 * 60 * 1000
const soon = (hours) => new Date(Date.now() + hours * HOUR)

beforeAll(async () => {
  await resetEmulators()
  await seedEvent('workshop-1', {
    title: 'Bike maintenance basics',
    type: 'Workshop',
    startsAt: soon(48),
    endsAt: soon(50),
    description: 'Learn to fix a flat.',
    clubName: 'Brunswick Cycling',
    access: ['Wheelchair accessible'],
    lat: -37.77,
    lng: 144.96,
    capacity: 10,
    registeredCount: 4,
    createdBy: 'creator-uid-123',
    internalNote: 'do not publish',
  })
  await seedEvent('ride-1', { title: 'Sunday ride', type: 'Ride', startsAt: soon(24), endsAt: soon(27) })
  await seedEvent('cancelled-1', {
    title: 'Called off',
    type: 'Workshop',
    startsAt: soon(72),
    endsAt: soon(74),
    status: 'cancelled',
  })
  await seedEvent('finished-1', { title: 'Already over', startsAt: soon(-5), endsAt: soon(-3) })
  await db
    .doc('events/workshop-1/registrations/rita')
    .set({ name: 'Rita Secret', email: 'rita@secret.example', needs: 'Quiet', registeredAt: new Date() })
})

describe('keys', () => {
  it('refuses a request with no key', async () => {
    const response = await publicGet('/events', {})

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('API_KEY_MISSING')
  })

  it('refuses a key that is not valid', async () => {
    const response = await publicGet('/events', { 'X-API-Key': 'demo-test-ke' })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('API_KEY_INVALID')
  })
})

describe('GET /api/public/v1/events', () => {
  it('lists upcoming events soonest first, including cancelled ones but not finished ones', async () => {
    const response = await publicGet('/events')

    expect(response.status).toBe(200)
    expect(response.body.data.map((event) => event.id)).toEqual(['ride-1', 'workshop-1', 'cancelled-1'])
    expect(response.body).toMatchObject({ count: 3, total: 3 })
    expect(response.body.data[2].state).toBe('cancelled')
  })

  it('filters by type, ignoring case', async () => {
    const response = await publicGet('/events?type=WORKSHOP')

    expect(response.body.data.map((event) => event.id)).toEqual(['workshop-1', 'cancelled-1'])
  })

  it('limits the page but still reports the total', async () => {
    const response = await publicGet('/events?limit=1')

    expect(response.body).toMatchObject({ count: 1, total: 3 })
  })

  it.each(['limit=0', 'limit=51', 'limit=abc', 'limt=5'])('refuses ?%s', async (query) => {
    const response = await publicGet(`/events?${query}`)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
  })
})

describe('GET /api/public/v1/events/{id}', () => {
  it('returns exactly the public fields and nothing about people', async () => {
    const response = await publicGet('/events/workshop-1')

    expect(response.status).toBe(200)
    expect(Object.keys(response.body.data).sort()).toEqual([...PUBLIC_EVENT_FIELDS].sort())
    expect(response.body.data).toMatchObject({
      id: 'workshop-1',
      title: 'Bike maintenance basics',
      location: { lat: -37.77, lng: 144.96 },
      capacity: 10,
      placesLeft: 6,
      state: 'open',
      access: ['Wheelchair accessible'],
      url: 'https://ecostride-82c87.web.app/events',
    })
    const text = JSON.stringify(response.body)
    for (const secret of ['creator-uid-123', 'rita@secret.example', 'Rita Secret', 'do not publish', 'registeredCount']) {
      expect(text).not.toContain(secret)
    }
  })

  it('reports an unknown event', async () => {
    const response = await publicGet('/events/no-such-event')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it('reports an unknown route under the public API', async () => {
    const response = await publicGet('/venues')

    expect(response.status).toBe(404)
  })
})

describe('GET /api/public/v1/openapi.json', () => {
  it('needs no key and points back at this API', async () => {
    const response = await publicGet('/openapi.json', {})

    expect(response.status).toBe(200)
    expect(response.body.openapi).toMatch(/^3\./)
    expect(response.body.servers[0].url).toMatch(/\/api$/)
  })
})

describe('headers', () => {
  it('keeps responses private to the caller and open to any website', async () => {
    const response = await publicGet('/events')

    expect(response.headers.get('cache-control')).toBe('private, max-age=60')
    expect(response.headers.get('vary')).toMatch(/X-API-Key/i)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-expose-headers')).toMatch(/Retry-After/)
    expect(Number(response.headers.get('x-ratelimit-remaining'))).toBeLessThan(60)
  })

  it('answers a browser preflight', async () => {
    const response = await api('/public/v1/events', {
      method: 'OPTIONS',
      headers: { Origin: 'https://partner.example', 'Access-Control-Request-Headers': 'x-api-key' },
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-headers')).toMatch(/X-API-Key/i)
  })

  it('is read-only', async () => {
    const response = await api('/public/v1/events', { method: 'POST', headers: DEMO, body: {} })

    expect(response.status).toBe(405)
    expect(response.body.error.code).toBe('METHOD_NOT_ALLOWED')
  })

  it("sends no CORS headers from the app's own API to another website", async () => {
    const rita = await signedInUser('rita-cors')

    const response = await api('/me', { token: rita.token, headers: { Origin: 'https://evil.example' } })

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('rate limit', () => {
  it('allows 60 requests a minute per key, then answers 429 with Retry-After', async () => {
    const burst = { 'X-API-Key': 'burst-test-key' }
    const responses = []
    for (let i = 0; i < 60; i += 1) responses.push(await publicGet('/events?limit=1', burst))

    const refused = await publicGet('/events?limit=1', burst)

    expect(responses.every((response) => response.status === 200)).toBe(true)
    expect(refused.status).toBe(429)
    expect(refused.body.error.code).toBe('RATE_LIMITED')
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0)
    // Another key is unaffected.
    expect((await publicGet('/events?limit=1')).status).toBe(200)
  })
})
