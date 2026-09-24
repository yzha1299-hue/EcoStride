import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs, signedOut } from './testEnv'

const workshop = {
  title: 'Active travel workshop',
  capacity: 30,
  registeredCount: 0,
  status: 'open',
  createdBy: 'clara',
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
