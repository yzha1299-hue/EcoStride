import { EVENT_STATE, eventState } from '../../shared/eventState.js'
import { toMelbourneInputs } from './format.js'

// Headline numbers for the admin dashboard from the upcoming (not yet ended)
// events. Cancelled events are counted separately and left out of places,
// registrations and the fill rate, since nobody can attend them.
export function summariseEvents(events, now = new Date()) {
  const active = events.filter((event) => eventState(event, now) !== EVENT_STATE.CANCELLED)
  const places = active.reduce((sum, event) => sum + event.capacity, 0)
  const registrations = active.reduce((sum, event) => sum + event.registeredCount, 0)
  return {
    upcoming: active.length,
    cancelled: events.length - active.length,
    full: active.filter((event) => eventState(event, now) === EVENT_STATE.FULL).length,
    places,
    registrations,
    // Whole percent; null when there are no places (not "0% full").
    fillRate: places ? Math.round((registrations / places) * 100) : null,
  }
}

// Chart data for the admin dashboard. Pure functions so they can be tested
// without Firestore or a browser.

const ROLE_ORDER = [
  ['participant', 'Participants'],
  ['clubMember', 'Club members'],
  ['admin', 'Admins'],
]

// { participant: 12, clubMember: 3 } -> every role, in a fixed order, with 0
// for roles nobody has yet (so the chart always shows all three).
export function roleCounts(countsByRole) {
  return ROLE_ORDER.map(([role, label]) => ({ role, label, count: countsByRole[role] ?? 0 }))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_MS = 24 * 60 * 60 * 1000

// Calendar arithmetic is done on UTC midnights of Melbourne calendar dates, so
// daylight saving (a 23- or 25-hour day in Melbourne) can't shift a week.
function melbourneDay(date) {
  const [year, month, day] = toMelbourneInputs(date).date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

function mondayOf(dayMs) {
  const daysSinceMonday = (new Date(dayMs).getUTCDay() + 6) % 7
  return dayMs - daysSinceMonday * DAY_MS
}

function isoDay(dayMs) {
  return new Date(dayMs).toISOString().slice(0, 10)
}

// New sign-ups in each of the last `weeks` Melbourne weeks (Monday to Sunday),
// oldest first, including weeks with none. Users without a sign-up date are
// skipped.
export function signupsPerWeek(users, { weeks = 12, now = new Date() } = {}) {
  const thisMonday = mondayOf(melbourneDay(now))
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = thisMonday - (weeks - 1 - i) * 7 * DAY_MS
    const date = new Date(start)
    return {
      weekStart: isoDay(start),
      label: `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`,
      count: 0,
    }
  })
  const firstMonday = thisMonday - (weeks - 1) * 7 * DAY_MS

  for (const user of users) {
    if (!(user.createdAt instanceof Date)) continue
    const monday = mondayOf(melbourneDay(user.createdAt))
    if (monday < firstMonday || monday > thisMonday) continue
    buckets[(monday - firstMonday) / (7 * DAY_MS)].count += 1
  }
  return buckets
}

// Upcoming events grouped by type: how many events, registrations and places
// still free. Cancelled events are left out. Types in alphabetical order.
export function eventsByType(events, now = new Date()) {
  const groups = new Map()
  for (const event of events) {
    if (eventState(event, now) === EVENT_STATE.CANCELLED) continue
    const group = groups.get(event.type) ?? { type: event.type, events: 0, registrations: 0, placesLeft: 0 }
    group.events += 1
    group.registrations += event.registeredCount
    group.placesLeft += Math.max(0, event.capacity - event.registeredCount)
    groups.set(event.type, group)
  }
  return [...groups.values()].sort((a, b) => a.type.localeCompare(b.type))
}
