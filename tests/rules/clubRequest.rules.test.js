import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs } from './testEnv'

// Becoming a club member needs an admin's approval. A new account is always a
// participant; asking to be a club member is a `clubRequest: 'pending'` flag on
// the profile, and only the server (Admin SDK, rules bypassed) can approve it.
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

const profile = (extra = {}) => ({
  email: 'alice@example.com',
  role: 'participant',
  createdAt: serverTimestamp(),
  ...extra,
})
const create = (data) => setDoc(doc(signedInAs(env, 'alice', 'alice@example.com'), 'users/alice'), data)

describe('signing up as a club member', () => {
  it('cannot be done by choosing the club member role directly', async () => {
    await assertFails(create(profile({ role: 'clubMember' })))
  })

  it('is a participant account with a pending request', async () => {
    await assertSucceeds(create(profile({ clubRequest: 'pending' })))
  })

  it('still lets a plain participant sign up', async () => {
    await assertSucceeds(create(profile()))
  })

  it.each(['declined', 'approved', 'clubMember', '', true])('cannot start with a request that is %j', async (value) => {
    await assertFails(create(profile({ clubRequest: value })))
  })

  it('cannot combine a request with the club member role', async () => {
    await assertFails(create(profile({ role: 'clubMember', clubRequest: 'pending' })))
  })
})

describe('after sign-up', () => {
  beforeEach(async () => {
    await seed(env, 'users/alice', { email: 'alice@example.com', role: 'participant', clubRequest: 'pending' })
    await seed(env, 'users/ada', { email: 'ada@example.com', role: 'admin' })
  })

  it('a user cannot approve their own request', async () => {
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertFails(updateDoc(doc(db, 'users/alice'), { role: 'clubMember' }))
    await assertFails(updateDoc(doc(db, 'users/alice'), { clubRequest: null }))
  })

  it('an admin cannot approve it from the browser either (only the server can)', async () => {
    await assertFails(updateDoc(doc(signedInAs(env, 'ada'), 'users/alice'), { role: 'clubMember' }))
  })

  it('an admin can list the pending requests', async () => {
    const pending = query(collection(signedInAs(env, 'ada'), 'users'), where('clubRequest', '==', 'pending'))

    await assertSucceeds(getDocs(pending))
  })

  it("a participant cannot list other people's requests", async () => {
    const pending = query(collection(signedInAs(env, 'alice', 'alice@example.com'), 'users'), where('clubRequest', '==', 'pending'))

    await assertFails(getDocs(pending))
  })
})
