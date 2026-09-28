import { describe, expect, it } from 'vitest'
import { summariseEvents } from './dashboard.js'

const NOW = new Date('2026-09-28T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function event(overrides = {}) {
  return { status: 'open', capacity: 10, registeredCount: 0, startsAt: new Date(NOW.getTime() + DAY), ...overrides }
}

describe('summariseEvents', () => {
  it('adds up places and registrations and works out the fill rate', () => {
    const summary = summariseEvents(
      [event({ capacity: 20, registeredCount: 5 }), event({ capacity: 30, registeredCount: 25 })],
      NOW,
    )

    expect(summary).toMatchObject({ upcoming: 2, places: 50, registrations: 30, fillRate: 60 })
  })

  it('counts full events', () => {
    const summary = summariseEvents([event({ capacity: 10, registeredCount: 10 }), event()], NOW)

    expect(summary.full).toBe(1)
  })

  it('counts cancelled events separately and leaves them out of the totals', () => {
    const summary = summariseEvents(
      [event({ capacity: 10, registeredCount: 4 }), event({ status: 'cancelled', capacity: 50, registeredCount: 40 })],
      NOW,
    )

    expect(summary).toMatchObject({ upcoming: 1, cancelled: 1, places: 10, registrations: 4, fillRate: 40 })
  })

  it('has no fill rate rather than 0% when there are no places', () => {
    expect(summariseEvents([], NOW)).toEqual({
      upcoming: 0,
      cancelled: 0,
      full: 0,
      places: 0,
      registrations: 0,
      fillRate: null,
    })
  })

  it('rounds the fill rate to a whole percent', () => {
    expect(summariseEvents([event({ capacity: 3, registeredCount: 1 })], NOW).fillRate).toBe(33)
  })
})
