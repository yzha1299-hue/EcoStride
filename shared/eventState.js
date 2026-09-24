// Shared by the web app (card badges) and the API Worker (registration checks),
// so "can someone register?" has exactly one definition.
//
// Only a human decision - cancellation - is stored on the event. "Full" and
// "closed" are derived from the numbers and the clock, so they can never drift
// out of sync with reality.
export const EVENT_STATE = {
  OPEN: 'open',
  FULL: 'full',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
}

// `event.startsAt` must be a Date.
export function eventState(event, now = new Date()) {
  if (event.status === 'cancelled') {
    return EVENT_STATE.CANCELLED
  }
  if (event.startsAt.getTime() <= now.getTime()) {
    return EVENT_STATE.CLOSED
  }
  if (event.registeredCount >= event.capacity) {
    return EVENT_STATE.FULL
  }
  return EVENT_STATE.OPEN
}

export function placesLeft(event) {
  return Math.max(0, event.capacity - event.registeredCount)
}
