import { beforeEach, describe, expect, it } from 'vitest'
import { api, resetEmulators, signedInUser } from './apiEnv'

// The map endpoints, through the real API function on the emulators. The test
// project has no OpenRouteService key and no Nominatim User-Agent, so a valid
// request ends in GEO_UNAVAILABLE and no map service is ever called.
let rita

beforeEach(async () => {
  await resetEmulators()
  rita = await signedInUser('rita')
})

const post = (path, body, user = rita) => api(path, { method: 'POST', token: user?.token, body })

const validBodies = {
  '/geo/search': { query: 'Footscray 3011' },
  '/geo/directions': { fromLat: -37.8, fromLng: 144.9, toLat: -37.81, toLng: 144.95, profile: 'cycling-regular' },
  '/geo/nearby': { lat: -37.8, lng: 144.9 },
}

describe.each(Object.entries(validBodies))('POST /api%s', (path, valid) => {
  it('needs a signed-in caller', async () => {
    const response = await post(path, valid, null)

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('refuses an unknown field', async () => {
    const response = await post(path, { ...valid, extra: 1 })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
  })

  it('says maps are unavailable when the server has no map configuration', async () => {
    const response = await post(path, valid)

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('GEO_UNAVAILABLE')
  })
})

describe('request validation', () => {
  it.each([
    ['/geo/search', {}],
    ['/geo/search', { query: 'x'.repeat(201) }],
    ['/geo/directions', { ...validBodies['/geo/directions'], profile: 'driving-car' }],
    ['/geo/directions', { ...validBodies['/geo/directions'], fromLat: 91 }],
    ['/geo/directions', { fromLat: -37.8 }],
    ['/geo/nearby', { lat: -37.8 }],
    ['/geo/nearby', { lat: -37.8, lng: 181 }],
  ])('%s refuses %j', async (path, body) => {
    const response = await post(path, body)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
  })
})
