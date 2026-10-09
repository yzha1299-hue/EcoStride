import { FieldValue } from 'firebase-admin/firestore'
import { EVENT_STATE, eventState } from '../../../shared/eventState.js'
import { isContention, plainData } from '../core/documents.js'
import { ApiError, notFound } from '../core/errors.js'
import { EVENT_ID } from '../core/validate.js'

// Registering and cancelling are the only ways registeredCount changes, and
// they run on the server so the capacity cap can't be bypassed (security rules
// forbid clients from writing registrations or the count). Each one is a
// Firestore transaction:
//
//   1. read the event and the caller's registration;
//   2. check the rules (open, not own event, not already registered, not full);
//   3. write the registration and the new count together.
//
// Firestore runs transactions on the same event one after another: if two
// people race for the last place, the second transaction is retried after the
// first commits, reads the event as full, and gets EVENT_FULL. The count can
// never exceed capacity, and it always equals the number of registrations.
const contention = () =>
  new ApiError(409, 'CONFLICT', 'Lots of people are registering right now. Please try again.')
const eventCancelled = () => new ApiError(409, 'EVENT_CANCELLED', 'This event has been cancelled.')
const eventClosed = () =>
  new ApiError(409, 'EVENT_CLOSED', 'This event has already started, so registration is closed.')

async function inTransaction(db, work) {
  try {
    return await db.runTransaction(work, { maxAttempts: 5 })
  } catch (error) {
    if (isContention(error)) throw contention()
    throw error
  }
}

async function readEventAndRegistration(tx, db, eventId, uid) {
  const eventRef = db.doc(`events/${eventId}`)
  const registrationRef = eventRef.collection('registrations').doc(uid)
  const [eventSnapshot, registrationSnapshot] = await tx.getAll(eventRef, registrationRef)
  if (!eventSnapshot.exists) {
    throw notFound('This event no longer exists.')
  }
  return { eventRef, registrationRef, event: plainData(eventSnapshot), registered: registrationSnapshot.exists }
}

export const registerSchema = {
  eventId: EVENT_ID,
  name: { type: 'string', required: true, maxLength: 100 },
  needs: { type: 'string', maxLength: 500 },
}

export async function register({ user, body, deps }) {
  const { db } = deps
  return inTransaction(db, async (tx) => {
    const { eventRef, registrationRef, event, registered } = await readEventAndRegistration(
      tx,
      db,
      body.eventId,
      user.uid,
    )

    const state = eventState(event)
    if (state === EVENT_STATE.CANCELLED) throw eventCancelled()
    if (state === EVENT_STATE.CLOSED) throw eventClosed()
    if (event.createdBy === user.uid) {
      throw new ApiError(403, 'OWN_EVENT', "You can't register for an event you created.")
    }
    if (registered) {
      throw new ApiError(409, 'ALREADY_REGISTERED', "You're already registered for this event.")
    }
    if (state === EVENT_STATE.FULL) {
      throw new ApiError(409, 'EVENT_FULL', 'Sorry, this event is now full.')
    }

    tx.create(registrationRef, {
      name: body.name,
      needs: body.needs ?? '',
      // From the verified ID token, never from the request.
      email: user.email,
      registeredAt: FieldValue.serverTimestamp(),
    })
    tx.update(eventRef, { registeredCount: FieldValue.increment(1) })

    return { eventId: body.eventId, registered: true, registeredCount: event.registeredCount + 1 }
  })
}

export const cancelSchema = { eventId: EVENT_ID }

export async function cancelRegistration({ user, body, deps }) {
  const { db } = deps
  return inTransaction(db, async (tx) => {
    const { eventRef, registrationRef, event, registered } = await readEventAndRegistration(
      tx,
      db,
      body.eventId,
      user.uid,
    )

    if (!registered) {
      throw new ApiError(404, 'NOT_REGISTERED', "You aren't registered for this event.")
    }
    // The roster is fixed once the event is under way.
    if (event.startsAt.getTime() <= Date.now()) throw eventClosed()

    tx.delete(registrationRef)
    tx.update(eventRef, { registeredCount: FieldValue.increment(-1) })

    return { eventId: body.eventId, registered: false, registeredCount: event.registeredCount - 1 }
  })
}
