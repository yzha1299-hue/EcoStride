import { fromMelbourneInputs } from './format'

export const EVENT_TYPES = ['Active travel', 'Club session', 'Workshop']
export const ACCESS_OPTIONS = ['Concession available', 'Family friendly', 'Wheelchair accessible']

// Mirrors the limits in firestore.rules. The rules are the real guard; this is
// here so people get a clear message next to the field instead of a rejection.
const LIMITS = { title: 120, venue: 120, address: 200, description: 2000, clubName: 120 }
const MAX_CAPACITY = 1000

export function emptyEventForm() {
  return {
    title: '',
    type: EVENT_TYPES[0],
    description: '',
    venue: '',
    address: '',
    date: '',
    startTime: '',
    endTime: '',
    capacity: '',
    access: [],
    clubName: '',
    // Map location picked from an address search; null until one is chosen.
    lat: null,
    lng: null,
    locationLabel: '',
  }
}

// Returns { fieldName: message } for every problem; empty object when valid.
// `minCapacity` is the number already registered when editing.
export function validateEventForm(form, { now = new Date(), minCapacity = 0 } = {}) {
  const errors = {}
  const required = { title: 'a title', venue: 'the venue name', address: 'the venue address' }

  for (const [field, label] of Object.entries(required)) {
    if (!form[field].trim()) {
      errors[field] = `Please enter ${label}.`
    }
  }
  for (const [field, max] of Object.entries(LIMITS)) {
    if (!errors[field] && form[field].trim().length > max) {
      errors[field] = `Keep this under ${max} characters.`
    }
  }

  if (!EVENT_TYPES.includes(form.type)) {
    errors.type = 'Please choose an event type.'
  }

  if (!form.date) {
    errors.date = 'Please choose a date.'
  }
  if (!form.startTime) {
    errors.startTime = 'Please choose a start time.'
  }
  if (!form.endTime) {
    errors.endTime = 'Please choose an end time.'
  }
  if (!errors.date && !errors.startTime) {
    const startsAt = fromMelbourneInputs(form.date, form.startTime)
    if (startsAt <= now) {
      errors.startTime = 'The event must start in the future.'
    } else if (!errors.endTime && fromMelbourneInputs(form.date, form.endTime) <= startsAt) {
      errors.endTime = 'The end time must be after the start time.'
    }
  }

  const capacity = Number(form.capacity)
  if (form.capacity === '' || !Number.isInteger(capacity) || capacity < 1) {
    errors.capacity = 'Enter a whole number of places, at least 1.'
  } else if (capacity > MAX_CAPACITY) {
    errors.capacity = `Capacity can be at most ${MAX_CAPACITY}.`
  } else if (capacity < minCapacity) {
    errors.capacity = `${minCapacity} people are already registered, so capacity can't be lower than that.`
  }

  return errors
}

// The editable fields as they are stored in Firestore.
export function eventFieldsFromForm(form) {
  return {
    title: form.title.trim(),
    type: form.type,
    description: form.description.trim(),
    venue: form.venue.trim(),
    address: form.address.trim(),
    startsAt: fromMelbourneInputs(form.date, form.startTime),
    endsAt: fromMelbourneInputs(form.date, form.endTime),
    capacity: Number(form.capacity),
    access: ACCESS_OPTIONS.filter((option) => form.access.includes(option)),
    clubName: form.clubName.trim(),
    ...(form.lat !== null && form.lng !== null ? { lat: form.lat, lng: form.lng } : {}),
  }
}
