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
  updateDoc,
} from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs, signedOut } from './testEnv'

// Registrations live at events/{eventId}/registrations/{uid}, keyed by the
// registrant. Only the API Worker (service account, rules bypassed) writes them,
// so every client write must be denied.
const registration = {
  name: 'Rita Registrant',
  needs: 'Step-free access',
  email: 'rita@example.com',
  registeredAt: new Date(),
}

let env

beforeAll(async () => {
  env = await createRulesEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(env, 'users/clara', { email: 'clara@example.com', role: 'clubMember' })
  await seed(env, 'users/dave', { email: 'dave@example.com', role: 'clubMember' })
  await seed(env, 'users/paul', { email: 'paul@example.com', role: 'participant' })
  await seed(env, 'events/e1', { title: 'Bike basics', capacity: 10, registeredCount: 1, status: 'open', createdBy: 'clara' })
  await seed(env, 'events/e1/registrations/rita', registration)
})

afterAll(async () => {
  await env.cleanup()
})

describe('reading registrations', () => {
  it('lets a registrant read their own registration', async () => {
    const db = signedInAs(env, 'rita')

    await assertSucceeds(getDoc(doc(db, 'events/e1/registrations/rita')))
  })

  it('lets a user check whether they are registered for an event they have not joined', async () => {
    const db = signedInAs(env, 'paul')

    await assertSucceeds(getDoc(doc(db, 'events/e1/registrations/paul')))
  })

  it("does not let a participant read someone else's registration", async () => {
    const db = signedInAs(env, 'paul')

    await assertFails(getDoc(doc(db, 'events/e1/registrations/rita')))
    await assertFails(getDocs(collection(db, 'events/e1/registrations')))
  })

  it("does not let another club member read an event's roster", async () => {
    const db = signedInAs(env, 'dave')

    await assertFails(getDoc(doc(db, 'events/e1/registrations/rita')))
    await assertFails(getDocs(collection(db, 'events/e1/registrations')))
  })

  it("lets the event's creator read every registration", async () => {
    const db = signedInAs(env, 'clara')

    await assertSucceeds(getDoc(doc(db, 'events/e1/registrations/rita')))
    await assertSucceeds(getDocs(collection(db, 'events/e1/registrations')))
  })

  it('does not let signed-out visitors read registrations', async () => {
    const db = signedOut(env)

    await assertFails(getDoc(doc(db, 'events/e1/registrations/rita')))
  })
})

describe('writing registrations', () => {
  it('does not let a user register themselves directly', async () => {
    const db = signedInAs(env, 'paul')

    await assertFails(
      setDoc(doc(db, 'events/e1/registrations/paul'), {
        name: 'Paul',
        email: 'paul@example.com',
        registeredAt: serverTimestamp(),
      }),
    )
  })

  it('does not let a registrant change or delete their registration directly', async () => {
    const db = signedInAs(env, 'rita')

    await assertFails(updateDoc(doc(db, 'events/e1/registrations/rita'), { needs: '' }))
    await assertFails(deleteDoc(doc(db, 'events/e1/registrations/rita')))
  })

  it("does not let the event's creator add, change or remove registrations", async () => {
    const db = signedInAs(env, 'clara')

    await assertFails(setDoc(doc(db, 'events/e1/registrations/ghost'), registration))
    await assertFails(updateDoc(doc(db, 'events/e1/registrations/rita'), { name: 'Changed' }))
    await assertFails(deleteDoc(doc(db, 'events/e1/registrations/rita')))
  })

  it('does not let a registrant or the creator change the registered count', async () => {
    await assertFails(updateDoc(doc(signedInAs(env, 'rita'), 'events/e1'), { registeredCount: 0 }))
    await assertFails(updateDoc(doc(signedInAs(env, 'clara'), 'events/e1'), { registeredCount: 5 }))
  })
})
