import { eventState, placesLeft } from '../../../shared/eventState.js'

// The only shape in which an event leaves EcoStride through the public API.
// Fields are copied one by one onto a new object - never spread from the
// stored document - so a field added to events later (or the creator's uid,
// or anything about registrations) can't leak by accident.
export const PUBLIC_EVENT_FIELDS = [
  'id',
  'title',
  'type',
  'description',
  'venue',
  'address',
  'location',
  'startsAt',
  'endsAt',
  'timezone',
  'capacity',
  'placesLeft',
  'state',
  'access',
  'clubName',
  'url',
]

const hasLocation = (event) => typeof event.lat === 'number' && typeof event.lng === 'number'

export function toPublicEvent(id, event, { now = new Date(), siteUrl }) {
  return {
    id,
    title: event.title,
    type: event.type,
    description: event.description ?? '',
    venue: event.venue,
    address: event.address,
    location: hasLocation(event) ? { lat: event.lat, lng: event.lng } : null,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    // Times are UTC; this is the zone EcoStride shows them in.
    timezone: 'Australia/Melbourne',
    capacity: event.capacity,
    placesLeft: placesLeft(event),
    // open | full | closed (started) | cancelled
    state: eventState(event, now),
    access: [...(event.access ?? [])],
    clubName: event.clubName ?? '',
    // Where people register (events have no page of their own yet).
    url: `${siteUrl.replace(/\/$/, '')}/events`,
  }
}
