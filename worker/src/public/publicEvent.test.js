import { describe, expect, it } from 'vitest'
import { PUBLIC_EVENT_FIELDS, toPublicEvent } from './publicEvent.js'

const NOW = new Date('2026-09-28T00:00:00Z')
const SITE = 'https://ecostride-82c87.web.app'

// An event as the Worker reads it from Firestore, including the fields that
// must never leave the platform.
function stored(overrides = {}) {
  return {
    title: 'Bike maintenance basics',
    type: 'Workshop',
    description: 'Fix a flat and adjust brakes.',
    venue: 'Brunswick Town Hall',
    address: '233 Sydney Rd, Brunswick VIC 3056',
    lat: -37.7667,
    lng: 144.9606,
    startsAt: new Date('2026-10-10T00:00:00Z'),
    endsAt: new Date('2026-10-10T02:00:00Z'),
    capacity: 16,
    registeredCount: 5,
    access: ['Wheelchair accessible'],
    clubName: 'Carlton Cycling Club',
    status: 'open',
    createdBy: 'secret-creator-uid',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    ...overrides,
  }
}

describe('toPublicEvent', () => {
  it('returns exactly the public fields, in a fixed order', () => {
    const event = toPublicEvent('bike-basics', stored(), { now: NOW, siteUrl: SITE })

    expect(Object.keys(event)).toEqual(PUBLIC_EVENT_FIELDS)
  })

  it('never exposes the creator, internal counts or timestamps, even if new fields appear', () => {
    const event = toPublicEvent(
      'bike-basics',
      stored({ registrations: [{ email: 'rita@example.com' }], emailRateLimit: 3 }),
      { now: NOW, siteUrl: SITE },
    )
    const json = JSON.stringify(event)

    expect(json).not.toContain('secret-creator-uid')
    expect(json).not.toContain('rita@example.com')
    for (const field of ['createdBy', 'createdAt', 'registeredCount', 'registrations', 'emailRateLimit', 'status']) {
      expect(event).not.toHaveProperty(field)
    }
  })

  it('gives times as ISO 8601 UTC with the display time zone alongside', () => {
    const event = toPublicEvent('bike-basics', stored(), { now: NOW, siteUrl: SITE })

    expect(event.startsAt).toBe('2026-10-10T00:00:00.000Z')
    expect(event.endsAt).toBe('2026-10-10T02:00:00.000Z')
    expect(event.timezone).toBe('Australia/Melbourne')
  })

  it('reports places left and the derived state', () => {
    const at = (overrides) => toPublicEvent('e', stored(overrides), { now: NOW, siteUrl: SITE })

    expect(at({})).toMatchObject({ capacity: 16, placesLeft: 11, state: 'open' })
    expect(at({ registeredCount: 16 })).toMatchObject({ placesLeft: 0, state: 'full' })
    expect(at({ status: 'cancelled' })).toMatchObject({ state: 'cancelled' })
    expect(at({ startsAt: new Date('2026-09-27T23:00:00Z') })).toMatchObject({ state: 'closed' })
  })

  it("works out the state at the time it is given, not the machine's clock", () => {
    const farFuture = stored({ startsAt: new Date('2099-01-01T00:00:00Z'), endsAt: new Date('2099-01-01T02:00:00Z') })

    expect(toPublicEvent('e', farFuture, { now: new Date('2099-01-01T01:00:00Z'), siteUrl: SITE }).state).toBe('closed')
    expect(toPublicEvent('e', farFuture, { now: NOW, siteUrl: SITE }).state).toBe('open')
  })

  it('groups the coordinates as a location, or null when the venue has none', () => {
    expect(toPublicEvent('e', stored(), { now: NOW, siteUrl: SITE }).location).toEqual({ lat: -37.7667, lng: 144.9606 })

    const { lat: _lat, lng: _lng, ...noCoordinates } = stored()
    expect(toPublicEvent('e', noCoordinates, { now: NOW, siteUrl: SITE }).location).toBeNull()
  })

  it('fills optional text with empty values rather than leaving them out', () => {
    const event = toPublicEvent('e', stored({ description: undefined, clubName: undefined, access: undefined }), {
      now: NOW,
      siteUrl: SITE,
    })

    expect(event).toMatchObject({ description: '', clubName: '', access: [] })
  })

  it('links to where people can register', () => {
    const event = toPublicEvent('bike-basics', stored(), { now: NOW, siteUrl: `${SITE}/` })

    expect(event.url).toBe(`${SITE}/events`)
  })
})
