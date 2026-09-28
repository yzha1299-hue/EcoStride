import { EVENT_STATE, eventState } from '../../shared/eventState.js'

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
