import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs } from './testEnv'

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

describe('collections without a rule', () => {
  it('are closed to signed-in users for both reading and writing', async () => {
    await seed(env, 'internalNotes/n1', { text: 'staff only' })
    const db = signedInAs(env, 'alice')

    await assertFails(getDoc(doc(db, 'internalNotes/n1')))
    await assertFails(setDoc(doc(db, 'internalNotes/n2'), { text: 'hello' }))
  })
})
