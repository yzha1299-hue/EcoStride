import { EVENT_STATE, eventState } from '../../../shared/eventState.js'
import { ApiError, notFound } from '../core/errors.js'
import { encodeFields, PreconditionFailed } from '../core/firestore.js'

// Registering and cancelling are the only ways registeredCount changes, and
// they run here rather than in the browser so the capacity cap can't be
// bypassed. Each one is a read-check-write:
//
//   1. read the event (with its updateTime) and the caller's registration;
//   2. check the rules (open, not own event, not already registered, not full);
//   3. commit the registration change and the count change together, on the
//      condition that the event hasn't changed since step 1.
//
// If two people race for the last place, both read "1 left", but only the first
// commit succeeds: it changes the event's updateTime, so the second commit's
// precondition fails and nothing of it is written. The loser re-reads, now sees
// the event full, and gets EVENT_FULL. The count can never exceed capacity.
const MAX_RETRIES = 3

const eventCancelled = () => new ApiError(409, 'EVENT_CANCELLED', 'This event has been cancelled.')
const eventClosed = () =>
  new ApiError(409, 'EVENT_CLOSED', 'This event has already started, so registration is closed.')

async function withRetries(attempt) {
  for (let tries = 0; tries <= MAX_RETRIES; tries += 1) {
    try {
      return await attempt()
    } catch (error) {
      if (!(error instanceof PreconditionFailed)) {
        throw error
      }
    }
  }
  throw new ApiError(409, 'CONFLICT', 'Lots of people are registering right now. Please try again.')
}

async function readEventAndRegistration(firestore, eventId, uid) {
  const eventPath = `events/${eventId}`
  const registrationPath = `${eventPath}/registrations/${uid}`
  const [event, registration] = await Promise.all([
    firestore.getDocument(eventPath),
    firestore.getDocument(registrationPath),
  ])
  if (!event) {
    throw notFound('This event no longer exists.')
  }
  return { event, registration, eventPath, registrationPath }
}

function changeCount(firestore, eventPath, event, delta) {
  return {
    transform: {
      document: firestore.documentName(eventPath),
      fieldTransforms: [{ fieldPath: 'registeredCount', increment: { integerValue: String(delta) } }],
    },
    currentDocument: { updateTime: event.updateTime },
  }
}

export const registerSchema = {
  eventId: { type: 'string', required: true, maxLength: 128, pattern: /^[\w-]+$/ },
  name: { type: 'string', required: true, maxLength: 100 },
  needs: { type: 'string', maxLength: 500 },
}

export async function register({ user, body, deps }) {
  const { firestore } = deps

  return withRetries(async () => {
    const { event, registration, eventPath, registrationPath } = await readEventAndRegistration(
      firestore,
      body.eventId,
      user.uid,
    )

    const state = eventState(event.data)
    if (state === EVENT_STATE.CANCELLED) throw eventCancelled()
    if (state === EVENT_STATE.CLOSED) throw eventClosed()
    if (event.data.createdBy === user.uid) {
      throw new ApiError(403, 'OWN_EVENT', "You can't register for an event you created.")
    }
    if (registration) {
      throw new ApiError(409, 'ALREADY_REGISTERED', "You're already registered for this event.")
    }
    if (state === EVENT_STATE.FULL) {
      throw new ApiError(409, 'EVENT_FULL', 'Sorry, this event is now full.')
    }

    await firestore.commit([
      {
        update: {
          name: firestore.documentName(registrationPath),
          // The email comes from the verified ID token, never from the request.
          fields: encodeFields({ name: body.name, needs: body.needs ?? '', email: user.email }),
        },
        updateTransforms: [{ fieldPath: 'registeredAt', setToServerValue: 'REQUEST_TIME' }],
        currentDocument: { exists: false },
      },
      changeCount(firestore, eventPath, event, 1),
    ])

    return { eventId: body.eventId, registered: true, registeredCount: event.data.registeredCount + 1 }
  })
}

export const cancelSchema = {
  eventId: { type: 'string', required: true, maxLength: 128, pattern: /^[\w-]+$/ },
}

export async function cancelRegistration({ user, body, deps }) {
  const { firestore } = deps

  return withRetries(async () => {
    const { event, registration, eventPath, registrationPath } = await readEventAndRegistration(
      firestore,
      body.eventId,
      user.uid,
    )

    if (!registration) {
      throw new ApiError(404, 'NOT_REGISTERED', "You aren't registered for this event.")
    }
    // The roster is fixed once the event is underway.
    if (event.data.startsAt.getTime() <= Date.now()) throw eventClosed()

    await firestore.commit([
      { delete: firestore.documentName(registrationPath), currentDocument: { exists: true } },
      changeCount(firestore, eventPath, event, -1),
    ])

    return { eventId: body.eventId, registered: false, registeredCount: event.data.registeredCount - 1 }
  })
}
