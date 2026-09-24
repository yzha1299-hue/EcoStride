import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs } from './testEnv'

// Daily bulk-email counters are written only by the API Worker.
let env

beforeAll(async () => {
  env = await createRulesEnv()
})

beforeEach(async () => {
  await env.clearFirestore()
  await seed(env, 'users/clara', { email: 'clara@example.com', role: 'clubMember' })
  await seed(env, 'events/e1', { title: 'Bike basics', createdBy: 'clara' })
  await seed(env, 'emailRateLimits/e1_2026-09-24', { eventId: 'e1', day: '2026-09-24', count: 5 })
})

afterAll(async () => {
  await env.cleanup()
})

describe('email rate-limit records', () => {
  it("can't be read, even by the event's creator", async () => {
    await assertFails(getDoc(doc(signedInAs(env, 'clara'), 'emailRateLimits/e1_2026-09-24')))
  })

  it("can't be reset, changed or created by the event's creator", async () => {
    const db = signedInAs(env, 'clara')

    await assertFails(updateDoc(doc(db, 'emailRateLimits/e1_2026-09-24'), { count: 0 }))
    await assertFails(deleteDoc(doc(db, 'emailRateLimits/e1_2026-09-24')))
    await assertFails(setDoc(doc(db, 'emailRateLimits/e1_2026-09-25'), { eventId: 'e1', day: '2026-09-25', count: 0 }))
  })
})
