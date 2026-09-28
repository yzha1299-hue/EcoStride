import { describe, expect, it } from 'vitest'
import { eventsByType, roleCounts, signupsPerWeek, summariseEvents } from './dashboard.js'

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

describe('signupsPerWeek', () => {
  // Melbourne weeks run Monday to Sunday. 2026-09-28 is a Monday.
  const melbourne = (iso) => new Date(iso)

  it('counts sign-ups in each of the last N Melbourne weeks, oldest first, including empty weeks', () => {
    const now = melbourne('2026-10-01T12:00:00+10:00') // Thursday
    const users = [
      { createdAt: melbourne('2026-09-28T09:00:00+10:00') }, // this week (Mon)
      { createdAt: melbourne('2026-09-30T23:30:00+10:00') }, // this week (Wed)
      { createdAt: melbourne('2026-09-27T23:59:00+10:00') }, // last week (Sun, late)
      { createdAt: melbourne('2026-09-14T08:00:00+10:00') }, // three weeks ago
    ]

    const weeks = signupsPerWeek(users, { weeks: 4, now })

    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(weeks.map((w) => w.count)).toEqual([0, 1, 1, 2])
  })

  it('uses the Melbourne date, not the UTC date, near midnight', () => {
    // 00:30 on Monday 28 Sep in Melbourne is still Sunday 27 Sep in UTC.
    const users = [{ createdAt: new Date('2026-09-27T14:30:00Z') }]

    const weeks = signupsPerWeek(users, { weeks: 2, now: new Date('2026-09-29T00:00:00Z') })

    expect(weeks.at(-1)).toMatchObject({ weekStart: '2026-09-28', count: 1 })
  })

  it('keeps weeks aligned to Mondays across the daylight-saving change', () => {
    // Daylight saving starts Sunday 4 Oct 2026. Monday 5 Oct 00:15 AEDT = Sunday 13:15 UTC.
    const users = [
      { createdAt: new Date('2026-10-04T13:15:00Z') }, // Mon 5 Oct, Melbourne
      { createdAt: new Date('2026-10-04T12:30:00Z') }, // Sun 4 Oct 23:30, Melbourne
    ]

    const weeks = signupsPerWeek(users, { weeks: 2, now: new Date('2026-10-07T00:00:00Z') })

    expect(weeks).toEqual([
      expect.objectContaining({ weekStart: '2026-09-28', count: 1 }),
      expect.objectContaining({ weekStart: '2026-10-05', count: 1 }),
    ])
  })

  it('ignores sign-ups older than the window and users without a sign-up date', () => {
    const users = [{ createdAt: new Date('2025-01-01T00:00:00Z') }, { createdAt: null }, {}]

    const weeks = signupsPerWeek(users, { weeks: 3, now: new Date('2026-09-29T00:00:00Z') })

    expect(weeks.map((w) => w.count)).toEqual([0, 0, 0])
  })

  it('gives each week a readable label', () => {
    const [week] = signupsPerWeek([], { weeks: 1, now: new Date('2026-09-29T00:00:00Z') })

    expect(week.label).toBe('28 Sep')
  })
})

describe('eventsByType', () => {
  const DAY_MS = 24 * 60 * 60 * 1000
  const future = new Date(NOW.getTime() + DAY_MS)

  it('groups events by type with events, registrations and places left, types in alphabetical order', () => {
    const groups = eventsByType(
      [
        { type: 'Workshop', capacity: 20, registeredCount: 5, status: 'open', startsAt: future },
        { type: 'Active travel', capacity: 10, registeredCount: 10, status: 'open', startsAt: future },
        { type: 'Workshop', capacity: 10, registeredCount: 2, status: 'open', startsAt: future },
      ],
      NOW,
    )

    expect(groups).toEqual([
      { type: 'Active travel', events: 1, registrations: 10, placesLeft: 0 },
      { type: 'Workshop', events: 2, registrations: 7, placesLeft: 23 },
    ])
  })

  it('leaves out cancelled events', () => {
    const groups = eventsByType(
      [{ type: 'Workshop', capacity: 20, registeredCount: 5, status: 'cancelled', startsAt: future }],
      NOW,
    )

    expect(groups).toEqual([])
  })
})

describe('roleCounts', () => {
  it('lists every role in a fixed order, including roles nobody has yet', () => {
    expect(roleCounts({ participant: 12, clubMember: 3 })).toEqual([
      { role: 'participant', label: 'Participants', count: 12 },
      { role: 'clubMember', label: 'Club members', count: 3 },
      { role: 'admin', label: 'Admins', count: 0 },
    ])
  })
})
