import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs, signedOut } from './testEnv'

const EVENT = 'active-travel-workshop'
const entry = (uid) => `eventRatings/${EVENT}/entries/${uid}`

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

describe('event ratings', () => {
  it('lets a signed-in user rate an event from 1 to 5', async () => {
    const db = signedInAs(env, 'alice')

    await assertSucceeds(setDoc(doc(db, entry('alice')), { rating: 1, updatedAt: serverTimestamp() }))
    await assertSucceeds(setDoc(doc(db, entry('alice')), { rating: 5, updatedAt: serverTimestamp() }))
  })

  it("does not let a user write someone else's rating", async () => {
    const db = signedInAs(env, 'mallory')

    await assertFails(setDoc(doc(db, entry('alice')), { rating: 5, updatedAt: serverTimestamp() }))
  })

  it('rejects ratings outside 1 to 5', async () => {
    const db = signedInAs(env, 'alice')

    await assertFails(setDoc(doc(db, entry('alice')), { rating: 0, updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, entry('alice')), { rating: 6, updatedAt: serverTimestamp() }))
  })

  it('rejects ratings that are not whole numbers', async () => {
    const db = signedInAs(env, 'alice')

    await assertFails(setDoc(doc(db, entry('alice')), { rating: 4.5, updatedAt: serverTimestamp() }))
    await assertFails(setDoc(doc(db, entry('alice')), { rating: '5', updatedAt: serverTimestamp() }))
  })

  it('rejects extra fields on a rating', async () => {
    const db = signedInAs(env, 'alice')

    await assertFails(
      setDoc(doc(db, entry('alice')), { rating: 5, updatedAt: serverTimestamp(), weight: 100 }),
    )
  })

  it('lets a user change their own rating', async () => {
    await seed(env, entry('alice'), { rating: 2 })
    const db = signedInAs(env, 'alice')

    await assertSucceeds(setDoc(doc(db, entry('alice')), { rating: 4, updatedAt: serverTimestamp() }))
  })

  it("lets a user remove their own rating but not someone else's", async () => {
    await seed(env, entry('alice'), { rating: 2 })
    await seed(env, entry('bob'), { rating: 3 })
    const db = signedInAs(env, 'alice')

    await assertSucceeds(deleteDoc(doc(db, entry('alice'))))
    await assertFails(deleteDoc(doc(db, entry('bob'))))
  })

  it('lets signed-in users read ratings but not signed-out visitors', async () => {
    await seed(env, entry('bob'), { rating: 3 })

    await assertSucceeds(getDoc(doc(signedInAs(env, 'alice'), entry('bob'))))
    await assertFails(getDoc(doc(signedOut(env), entry('bob'))))
  })
})
