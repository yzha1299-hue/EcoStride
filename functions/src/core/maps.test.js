import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMapServices } from './maps.js'

// Nearby facilities come from the public Overpass servers, which are often
// overloaded or unreachable, so the lookup tries several of them in turn.
const maps = () => createMapServices({ orsApiKey: 'k', userAgent: 'test-agent' })

const overpassAnswer = (elements = []) => new Response(JSON.stringify({ elements }), { status: 200 })
const toilet = { type: 'node', id: 1, lat: -37.8, lon: 144.9, tags: { amenity: 'toilets' } }

// The fetch stub answers each call from `plan`, in order; a function is
// called, an Error is thrown (a failed connection).
function stubFetch(plan) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      calls.push(String(url))
      const step = plan[calls.length - 1]
      if (step instanceof Error) throw step
      return step
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

// Each test uses its own coordinates: results are cached per place.
let nextLat = -30
const point = () => [{ lat: (nextLat -= 0.5), lng: 144.5 }]

describe('nearby', () => {
  it('uses the first server when it answers', async () => {
    const calls = stubFetch([overpassAnswer([toilet])])

    const places = await maps().nearby(point())

    expect(places).toHaveLength(1)
    expect(calls).toHaveLength(1)
  })

  it.each([
    ['is overloaded (504)', () => new Response('busy', { status: 504 })],
    ['is rate limiting (429)', () => new Response('slow down', { status: 429 })],
    ['has an internal error (500)', () => new Response('oops', { status: 500 })],
    ['cannot be reached', () => new TypeError('fetch failed')],
    ['runs out of time on the server', () => new Response(JSON.stringify({ elements: [], remark: 'runtime error: Query timed out' }), { status: 200 })],
  ])('tries the next server when the first %s', async (_what, failure) => {
    const calls = stubFetch([failure(), overpassAnswer([toilet])])

    const places = await maps().nearby(point())

    expect(places).toHaveLength(1)
    expect(calls).toHaveLength(2)
    expect(calls[1]).not.toBe(calls[0])
  })

  it('says the service is busy when every server fails', async () => {
    const calls = stubFetch([new TypeError('fetch failed'), new Response('', { status: 504 }), new Response('', { status: 504 }), new Response('', { status: 504 })])

    await expect(maps().nearby(point())).rejects.toMatchObject({ status: 503, code: 'GEO_BUSY' })
    expect(calls.length).toBeGreaterThan(1)
    expect(new Set(calls).size).toBe(calls.length)
  })

  it('starts with the server that worked last time', async () => {
    const service = maps()
    const first = stubFetch([new Response('', { status: 504 }), overpassAnswer([toilet])])
    await service.nearby(point())
    vi.unstubAllGlobals()

    const second = stubFetch([overpassAnswer([toilet])])
    await service.nearby(point())

    expect(second[0]).toBe(first[1])
  })

  it('is unavailable without a User-Agent', async () => {
    await expect(createMapServices({ orsApiKey: 'k', userAgent: '' }).nearby(point())).rejects.toMatchObject({
      code: 'GEO_UNAVAILABLE',
    })
  })
})
