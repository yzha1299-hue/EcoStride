import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs } from './testEnv'

// The admin role is granted only by scripts/make-admin.mjs (Admin SDK, rules
// bypassed). An admin can see every profile, for the dashboard's user counts,
// but can't change anyone's profile or role from the browser.
let env

beforeAll(async () => {
  env = await createRulesEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(env, 'users/ada', { email: 'ada@example.com', role: 'admin' })
  await seed(env, 'users/clara', { email: 'clara@example.com', role: 'clubMember' })
  await seed(env, 'users/paul', { email: 'paul@example.com', role: 'participant' })
})

afterAll(async () => {
  await env.cleanup()
})

describe('becoming an admin', () => {
  it("can't be done by choosing the admin role at sign-up", async () => {
    const db = signedInAs(env, 'mallory', 'mallory@example.com')

    await assertFails(
      setDoc(doc(db, 'users/mallory'), { email: 'mallory@example.com', role: 'admin', createdAt: serverTimestamp() }),
    )
  })

  it("can't be done by a user changing their own role", async () => {
    await assertFails(updateDoc(doc(signedInAs(env, 'paul'), 'users/paul'), { role: 'admin' }))
    await assertFails(updateDoc(doc(signedInAs(env, 'clara'), 'users/clara'), { role: 'admin' }))
  })
})

describe('reading user profiles', () => {
  it('lets an admin read any profile and list them all', async () => {
    const db = signedInAs(env, 'ada')

    await assertSucceeds(getDoc(doc(db, 'users/paul')))
    await assertSucceeds(getDocs(collection(db, 'users')))
  })

  it('lets an admin count users by role', async () => {
    const db = signedInAs(env, 'ada')

    await assertSucceeds(getCountFromServer(query(collection(db, 'users'), where('role', '==', 'participant'))))
    await assertSucceeds(getCountFromServer(collection(db, 'users')))
  })

  it("doesn't let club members or participants list users or read another profile", async () => {
    for (const uid of ['clara', 'paul']) {
      const db = signedInAs(env, uid)
      await assertFails(getDocs(collection(db, 'users')))
      await assertFails(getCountFromServer(collection(db, 'users')))
      await assertFails(getDoc(doc(db, 'users/ada')))
    }
  })

  it('still lets every user read their own profile', async () => {
    await assertSucceeds(getDoc(doc(signedInAs(env, 'paul'), 'users/paul')))
  })
})

describe('what an admin still cannot do', () => {
  it("can't change, delete or create other users' profiles", async () => {
    const db = signedInAs(env, 'ada')

    await assertFails(updateDoc(doc(db, 'users/paul'), { role: 'clubMember' }))
    await assertFails(deleteDoc(doc(db, 'users/paul')))
    await assertFails(setDoc(doc(db, 'users/newbie'), { email: 'newbie@example.com', role: 'admin' }))
  })

  it("can't change their own role", async () => {
    await assertFails(updateDoc(doc(signedInAs(env, 'ada'), 'users/ada'), { role: 'participant' }))
  })

  it("can't read another club's event registrations", async () => {
    await seed(env, 'events/e1', { title: 'Bike basics', createdBy: 'clara', registeredCount: 1 })
    await seed(env, 'events/e1/registrations/paul', { name: 'Paul', email: 'paul@example.com' })
    const db = signedInAs(env, 'ada')

    await assertFails(getDoc(doc(db, 'events/e1/registrations/paul')))
    await assertFails(getDocs(collection(db, 'events/e1/registrations')))
  })

  it("can't create events (admin is an overview role)", async () => {
    const db = signedInAs(env, 'ada')

    await assertFails(
      setDoc(doc(db, 'events/admin-event'), { title: 'Nope', createdBy: 'ada', registeredCount: 0, status: 'open' }),
    )
  })
})
