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

const dateTime = new Intl.DateTimeFormat('en-AU', {
  timeZone: MELBOURNE_TZ,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

// "23 Sept 2026, 3:05 pm", for timestamps such as when someone registered.
export function formatDateTime(date) {
  return dateTime.format(date)
}

// "Saturday 6 September 2026", used where the date must be unambiguous (e.g. screen readers).
export function formatLongDate(date) {
  return longDate.format(date)
}

// The Melbourne calendar date and time of an instant, in the formats
// <input type="date"> and <input type="time"> use: { date: '2026-10-04', time: '09:30' }.
export function toMelbourneInputs(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: MELBOURNE_TZ,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

// Inverse of toMelbourneInputs: form values typed in Melbourne time -> Date.
export function fromMelbourneInputs(dateValue, timeValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  return melbourneTimeToDate({ year, month, day, hour, minute })
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
