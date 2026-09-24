import { describe, expect, it } from 'vitest'
import { melbourneTimeToDate } from '../../../src/utils/format.js'
import { eventToIcs } from './ics.js'

// Melbourne wall-clock times, converted the same way the event form does.
const melbourne = (year, month, day, hour, minute = 0) => melbourneTimeToDate({ year, month, day, hour, minute })

function event(overrides = {}) {
  return {
    id: 'bike-basics',
    title: 'Bike maintenance basics',
    description: 'Fix a flat and adjust brakes.',
    venue: 'Brunswick Town Hall',
    address: '233 Sydney Rd, Brunswick VIC 3056',
    startsAt: melbourne(2026, 10, 10, 10),
    endsAt: melbourne(2026, 10, 10, 12),
    status: 'open',
    ...overrides,
  }
}

const NOW = new Date('2026-09-24T04:05:06.789Z')

// Undoes line folding, then returns the lines as a list.
function lines(ics) {
  return ics.replace(/\r\n /g, '').split('\r\n')
}

function property(ics, name) {
  const line = lines(ics).find((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`))
  return line?.slice(line.indexOf(':') + 1)
}

describe('eventToIcs structure', () => {
  it('wraps one event in a calendar with the required fields', () => {
    const all = lines(eventToIcs(event(), { now: NOW }))

    expect(all[0]).toBe('BEGIN:VCALENDAR')
    expect(all).toContain('VERSION:2.0')
    expect(all.some((l) => l.startsWith('PRODID:'))).toBe(true)
    expect(all).toContain('BEGIN:VEVENT')
    expect(all).toContain('END:VEVENT')
    expect(all.at(-2)).toBe('END:VCALENDAR')
    expect(all.at(-1)).toBe('')
  })

  it('uses CRLF line endings throughout', () => {
    const ics = eventToIcs(event(), { now: NOW })

    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('gives the event a stable UID, so a later invite updates the same calendar entry', () => {
    const first = property(eventToIcs(event(), { now: NOW }), 'UID')
    const later = property(eventToIcs(event({ title: 'Changed' }), { now: new Date() }), 'UID')

    expect(first).toBe('bike-basics@ecostride')
    expect(later).toBe(first)
  })

  it('stamps the time the invite was made, in UTC without milliseconds', () => {
    expect(property(eventToIcs(event(), { now: NOW }), 'DTSTAMP')).toBe('20260924T040506Z')
  })

  it('includes title, location and description', () => {
    const ics = eventToIcs(event(), { now: NOW })

    expect(property(ics, 'SUMMARY')).toBe('Bike maintenance basics')
    expect(property(ics, 'LOCATION')).toBe('Brunswick Town Hall\\, 233 Sydney Rd\\, Brunswick VIC 3056')
    expect(property(ics, 'DESCRIPTION')).toBe('Fix a flat and adjust brakes.')
  })

  it('leaves out an empty description', () => {
    expect(property(eventToIcs(event({ description: '' }), { now: NOW }), 'DESCRIPTION')).toBeUndefined()
  })

  it('marks events as confirmed, or cancelled once cancelled', () => {
    expect(property(eventToIcs(event(), { now: NOW }), 'STATUS')).toBe('CONFIRMED')
    expect(property(eventToIcs(event({ status: 'cancelled' }), { now: NOW }), 'STATUS')).toBe('CANCELLED')
  })
})

describe('eventToIcs times', () => {
  // Melbourne is UTC+10 (AEST) in winter and UTC+11 (AEDT) in summer. In 2026
  // daylight saving starts at 2:00 am on Sunday 4 October and ends at 3:00 am
  // on Sunday 5 April.
  it('converts a 10 am start the day before daylight saving starts (UTC+10)', () => {
    const ics = eventToIcs(event({ startsAt: melbourne(2026, 10, 3, 10), endsAt: melbourne(2026, 10, 3, 12) }), { now: NOW })

    expect(property(ics, 'DTSTART')).toBe('20261003T000000Z')
    expect(property(ics, 'DTEND')).toBe('20261003T020000Z')
  })

  it('converts a 10 am start the day after daylight saving starts (UTC+11)', () => {
    const ics = eventToIcs(event({ startsAt: melbourne(2026, 10, 5, 10), endsAt: melbourne(2026, 10, 5, 12) }), { now: NOW })

    expect(property(ics, 'DTSTART')).toBe('20261004T230000Z')
    expect(property(ics, 'DTEND')).toBe('20261005T010000Z')
  })

  it('converts times either side of daylight saving ending in April', () => {
    const before = eventToIcs(event({ startsAt: melbourne(2026, 4, 4, 18, 30), endsAt: melbourne(2026, 4, 4, 20) }), { now: NOW })
    const after = eventToIcs(event({ startsAt: melbourne(2026, 4, 6, 18, 30), endsAt: melbourne(2026, 4, 6, 20) }), { now: NOW })

    expect(property(before, 'DTSTART')).toBe('20260404T073000Z')
    expect(property(after, 'DTSTART')).toBe('20260406T083000Z')
  })

  it('keeps the real length of an event that spans the switch', () => {
    // 1:00 am to 4:00 am on the clock, but 2:00 am jumps to 3:00 am: 2 real hours.
    const ics = eventToIcs(event({ startsAt: melbourne(2026, 10, 4, 1), endsAt: melbourne(2026, 10, 4, 4) }), { now: NOW })

    expect(property(ics, 'DTSTART')).toBe('20261003T150000Z')
    expect(property(ics, 'DTEND')).toBe('20261003T170000Z')
  })

  it('writes times in UTC, not with a time zone', () => {
    const ics = eventToIcs(event(), { now: NOW })

    expect(ics).not.toMatch(/TZID/)
    expect(property(ics, 'DTSTART')).toMatch(/^\d{8}T\d{6}Z$/)
  })
})

describe('eventToIcs text escaping', () => {
  it('escapes backslashes, semicolons, commas and line breaks', () => {
    const ics = eventToIcs(event({ title: 'Paths; parks, and C:\\bikes', description: 'Line one\nLine two\r\nLine three' }), { now: NOW })

    expect(property(ics, 'SUMMARY')).toBe('Paths\\; parks\\, and C:\\\\bikes')
    expect(property(ics, 'DESCRIPTION')).toBe('Line one\\nLine two\\nLine three')
  })

  it('cannot be tricked into adding properties through a line break', () => {
    const ics = eventToIcs(event({ title: 'Ride\r\nEND:VEVENT\r\nBEGIN:VEVENT' }), { now: NOW })

    expect(lines(ics).filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1)
  })

  it('folds long lines at 75 bytes without splitting a character', () => {
    const description = 'Café ride along the Merri Creek trail 🚲 '.repeat(8)
    const ics = eventToIcs(event({ description }), { now: NOW })

    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
    expect(property(ics, 'DESCRIPTION')).toBe(description)
  })
})
