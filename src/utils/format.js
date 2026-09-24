export function formatNumber(value) {
  return new Intl.NumberFormat('en-AU').format(value)
}

// All event times are stored as UTC instants and always shown in Melbourne time,
// whatever time zone the viewer's device is in. Daylight saving is handled by
// the Intl API's time-zone database.
export const MELBOURNE_TZ = 'Australia/Melbourne'

const dayParts = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TZ,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

const timeOfDay = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const longDate = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// { weekday: 'Sat', day: '06', month: 'Sep' } for the date badge.
export function formatEventDay(date) {
  const parts = Object.fromEntries(dayParts.formatToParts(date).map((part) => [part.type, part.value]))
  return { weekday: parts.weekday, day: parts.day, month: parts.month }
}

// "10:00 am - 12:00 pm"
export function formatTimeRange(start, end) {
  return `${timeOfDay.format(start)} - ${timeOfDay.format(end)}`
}

// "Saturday 6 September 2026", used where the date must be unambiguous (e.g. screen readers).
export function formatLongDate(date) {
  return longDate.format(date)
}

// Milliseconds Melbourne is ahead of UTC at a given instant (10 or 11 hours).
function melbourneOffsetMs(instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: MELBOURNE_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  )
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

// Turns a Melbourne wall-clock time (as typed into a form) into the UTC instant
// it names. The offset is re-checked at the result so times near a daylight-
// saving switch land on the right side of it.
export function melbourneTimeToDate({ year, month, day, hour = 0, minute = 0 }) {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute)
  let instant = new Date(wallClockAsUtc - melbourneOffsetMs(new Date(wallClockAsUtc)))
  const corrected = new Date(wallClockAsUtc - melbourneOffsetMs(instant))
  if (corrected.getTime() !== instant.getTime()) {
    instant = corrected
  }
  return instant
}
