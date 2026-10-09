// Builds the calendar invite (.ics, RFC 5545) attached to event emails.
// Pure: event data in, calendar text out.
//
// Times are written in UTC ("...Z"). Every calendar app converts UTC to the
// reader's own zone, which avoids shipping Melbourne's daylight-saving rules in
// a VTIMEZONE block. The event's times are already UTC instants (Dates), so
// the Melbourne wall-clock conversion happened once, when the event was saved.
const MAX_LINE_BYTES = 75

// 2026-10-03T00:00:00.000Z -> 20261003T000000Z
function utc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// TEXT values escape \ ; , and turn any line break into a literal "\n", so user
// text can never start a new property.
function text(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// Lines longer than 75 bytes continue on the next line after CRLF + space.
// Splits between characters, never inside a multi-byte one.
function fold(line) {
  const encoder = new TextEncoder()
  const parts = []
  let current = ''
  let currentBytes = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    const limit = parts.length ? MAX_LINE_BYTES - 1 : MAX_LINE_BYTES
    if (currentBytes + bytes > limit) {
      parts.push(current)
      current = ''
      currentBytes = 0
    }
    current += char
    currentBytes += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

// `event`: { id, title, description?, venue, address, startsAt, endsAt, status }
export function eventToIcs(event, { now = new Date() } = {}) {
  const location = [event.venue, event.address].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EcoStride//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable per event, so a later invite updates the same calendar entry.
    `UID:${event.id}@ecostride`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(event.startsAt)}`,
    `DTEND:${utc(event.endsAt)}`,
    `SUMMARY:${text(event.title)}`,
    location && `LOCATION:${text(location)}`,
    event.description && `DESCRIPTION:${text(event.description)}`,
    `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return lines.map(fold).join('\r\n') + '\r\n'
}
