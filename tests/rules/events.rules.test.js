import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs, signedOut } from './testEnv'

const workshop = {
  title: 'Active travel workshop',
  capacity: 30,
  registeredCount: 0,
  status: 'open',
  createdBy: 'clara',
}

const DAY = 24 * 60 * 60 * 1000

// A valid new event as the create form would send it, created by `uid`.
function newEvent(uid, overrides = {}) {
  const startsAt = new Date(Date.now() + 7 * DAY)
  return {
    title: 'Bike maintenance basics',
    type: 'Active travel',
    description: 'Fix a flat and adjust brakes.',
    venue: 'Brunswick Town Hall',
    address: '233 Sydney Rd, Brunswick VIC 3056',
    startsAt: Timestamp.fromDate(startsAt),
    endsAt: Timestamp.fromDate(new Date(startsAt.getTime() + 2 * 60 * 60 * 1000)),
    capacity: 16,
    registeredCount: 0,
    access: ['Family friendly'],
    clubName: 'Carlton Cycling Club',
    status: 'open',
    createdBy: uid,
    createdAt: serverTimestamp(),
    ...overrides,
  }
}

// Seeds a stored event owned by `uid` (as it would look after creation).
async function seedOwnedEvent(id, uid, overrides = {}) {
  const { createdAt: _ignored, ...data } = newEvent(uid)
  await seed(env, `events/${id}`, { ...data, ...overrides })
}

async function seedProfile(uid, role) {
  await seed(env, `users/${uid}`, { email: `${uid}@example.com`, role })
}

let env

beforeAll(async () => {
  env = await createRulesEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
})

afterAll(async () => {
  await env.cleanup()
})

describe('reading events', () => {
  it('lets any signed-in user read events', async () => {
    await seed(env, 'events/active-travel-workshop', workshop)
    const db = signedInAs(env, 'alice')

    await assertSucceeds(getDoc(doc(db, 'events/active-travel-workshop')))
    await assertSucceeds(getDocs(collection(db, 'events')))
  })

  it('does not let signed-out visitors read events', async () => {
    await seed(env, 'events/active-travel-workshop', workshop)
    const db = signedOut(env)

    await assertFails(getDoc(doc(db, 'events/active-travel-workshop')))
    await assertFails(getDocs(collection(db, 'events')))
  })
})

describe('changing events', () => {
  it('does not let a signed-in user overwrite the registered count', async () => {
    await seed(env, 'events/active-travel-workshop', workshop)
    const db = signedInAs(env, 'alice')

    await assertFails(updateDoc(doc(db, 'events/active-travel-workshop'), { registeredCount: 0 }))
  })
})

describe('creating events', () => {
  it('lets a club member create an event they own', async () => {
    await seedProfile('clara', 'clubMember')
    const db = signedInAs(env, 'clara')

    await assertSucceeds(setDoc(doc(db, 'events/new-event'), newEvent('clara')))
  })

  it('does not let a participant create events', async () => {
    await seedProfile('paul', 'participant')
    const db = signedInAs(env, 'paul')

    await assertFails(setDoc(doc(db, 'events/new-event'), newEvent('paul')))
  })

  it('does not let a club member create an event on behalf of someone else', async () => {
    await seedProfile('clara', 'clubMember')
    const db = signedInAs(env, 'clara')

    await assertFails(setDoc(doc(db, 'events/new-event'), newEvent('dave')))
  })

  it('requires a new event to start open with nobody registered', async () => {
    await seedProfile('clara', 'clubMember')
    const db = signedInAs(env, 'clara')

    await assertFails(setDoc(doc(db, 'events/e1'), newEvent('clara', { registeredCount: 5 })))
    await assertFails(setDoc(doc(db, 'events/e2'), newEvent('clara', { status: 'cancelled' })))
  })

  it('rejects malformed events even if the form is bypassed', async () => {
    await seedProfile('clara', 'clubMember')
    const db = signedInAs(env, 'clara')
    const base = newEvent('clara')
    const create = (overrides) => setDoc(doc(db, 'events/bad'), { ...base, ...overrides })

    await assertFails(create({ featured: true }))
    await assertFails(create({ title: '' }))
    await assertFails(create({ capacity: 0 }))
    await assertFails(create({ capacity: 2.5 }))
    await assertFails(create({ endsAt: base.startsAt }))
    await assertFails(
      create({
        startsAt: Timestamp.fromDate(new Date(Date.now() - DAY)),
        endsAt: Timestamp.fromDate(new Date(Date.now() - DAY + 3600_000)),
      }),
    )
  })
})

describe('editing events', () => {
  it('lets the creator edit their event', async () => {
    await seedProfile('clara', 'clubMember')
    await seedOwnedEvent('e1', 'clara')
    const db = signedInAs(env, 'clara')

    await assertSucceeds(updateDoc(doc(db, 'events/e1'), { title: 'Bike repair night', capacity: 20 }))
  })

  it("does not let another club member edit someone else's event", async () => {
    await seedProfile('clara', 'clubMember')
    await seedProfile('dave', 'clubMember')
    await seedOwnedEvent('e1', 'clara')
    const db = signedInAs(env, 'dave')

    await assertFails(updateDoc(doc(db, 'events/e1'), { title: 'Taken over' }))
  })

  it('does not let the creator hand over the event or touch server-managed fields', async () => {
    await seedProfile('clara', 'clubMember')
    await seedOwnedEvent('e1', 'clara', { registeredCount: 3 })
    const db = signedInAs(env, 'clara')

    await assertFails(updateDoc(doc(db, 'events/e1'), { createdBy: 'dave' }))
    await assertFails(updateDoc(doc(db, 'events/e1'), { registeredCount: 0 }))
    await assertFails(updateDoc(doc(db, 'events/e1'), { createdAt: serverTimestamp() }))
  })

  it('does not let capacity drop below the number already registered', async () => {
    await seedProfile('clara', 'clubMember')
    await seedOwnedEvent('e1', 'clara', { capacity: 20, registeredCount: 12 })
    const db = signedInAs(env, 'clara')

    await assertFails(updateDoc(doc(db, 'events/e1'), { capacity: 11 }))
    await assertSucceeds(updateDoc(doc(db, 'events/e1'), { capacity: 12 }))
  })

  it('rejects edits that would leave the event malformed', async () => {
    await seedProfile('clara', 'clubMember')
    await seedOwnedEvent('e1', 'clara')
    const db = signedInAs(env, 'clara')
    const ref = doc(db, 'events/e1')

    await assertFails(updateDoc(ref, { title: '' }))
    await assertFails(updateDoc(ref, { featured: true }))
    // The seeded event starts in a week, so ending now would end before it starts.
    await assertFails(updateDoc(ref, { endsAt: Timestamp.now() }))
  })

  it('lets the creator cancel an event but never reopen it', async () => {
    await seedProfile('clara', 'clubMember')
    await seedOwnedEvent('e1', 'clara')
    const db = signedInAs(env, 'clara')

    await assertSucceeds(updateDoc(doc(db, 'events/e1'), { status: 'cancelled' }))
    await assertFails(updateDoc(doc(db, 'events/e1'), { status: 'open' }))
  })
})

describe('deleting events', () => {
  it('lets the creator delete an event nobody has registered for', async () => {
    await seedProfile('clara', 'clubMember')
    await seedOwnedEvent('e1', 'clara', { registeredCount: 0 })
    const db = signedInAs(env, 'clara')

    await assertSucceeds(deleteDoc(doc(db, 'events/e1')))
  })

  it('does not let the creator delete an event people have registered for', async () => {
    await seedProfile('clara', 'clubMember')
    await seedOwnedEvent('e1', 'clara', { registeredCount: 1 })
    const db = signedInAs(env, 'clara')

    await assertFails(deleteDoc(doc(db, 'events/e1')))
  })

  it("does not let another club member delete someone else's event", async () => {
    await seedProfile('dave', 'clubMember')
    await seedOwnedEvent('e1', 'clara', { registeredCount: 0 })
    const db = signedInAs(env, 'dave')

    await assertFails(deleteDoc(doc(db, 'events/e1')))
  })
})
