import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs } from './testEnv'

// Daily "Draft with AI" counters are written only by the API Worker.
let env

beforeAll(async () => {
  env = await createRulesEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(env, 'users/clara', { email: 'clara@example.com', role: 'clubMember' })
  await seed(env, 'users/ada', { email: 'ada@example.com', role: 'admin' })
  await seed(env, 'aiUsage/clara_2026-09-28', { day: '2026-09-28', count: 20 })
})

afterAll(async () => {
  await env.cleanup()
})

describe('AI usage records', () => {
  it("can't be read or reset by the user they count", async () => {
    const db = signedInAs(env, 'clara')

    await assertFails(getDoc(doc(db, 'aiUsage/clara_2026-09-28')))
    await assertFails(updateDoc(doc(db, 'aiUsage/clara_2026-09-28'), { count: 0 }))
    await assertFails(deleteDoc(doc(db, 'aiUsage/clara_2026-09-28')))
    await assertFails(setDoc(doc(db, 'aiUsage/clara_2026-09-29'), { day: '2026-09-29', count: 0 }))
  })

  it("can't be read by an admin either", async () => {
    await assertFails(getDoc(doc(signedInAs(env, 'ada'), 'aiUsage/clara_2026-09-28')))
  })
})
