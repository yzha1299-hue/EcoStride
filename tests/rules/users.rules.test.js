import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { createRulesEnv, seed, signedInAs, signedOut } from './testEnv'

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

describe('user profiles', () => {
  it('lets a signed-in user create their own profile with a valid role', async () => {
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertSucceeds(
      setDoc(doc(db, 'users/alice'), {
        email: 'alice@example.com',
        role: 'participant',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it("does not let a user create someone else's profile", async () => {
    const db = signedInAs(env, 'mallory', 'mallory@example.com')

    await assertFails(
      setDoc(doc(db, 'users/alice'), {
        email: 'mallory@example.com',
        role: 'participant',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('rejects a role outside participant and club member', async () => {
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertFails(
      setDoc(doc(db, 'users/alice'), {
        email: 'alice@example.com',
        role: 'admin',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it("rejects a profile whose email doesn't match the signed-in account", async () => {
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertFails(
      setDoc(doc(db, 'users/alice'), {
        email: 'someone-else@example.com',
        role: 'participant',
        createdAt: serverTimestamp(),
      }),
    )
  })

  it('rejects extra fields on a new profile', async () => {
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertFails(
      setDoc(doc(db, 'users/alice'), {
        email: 'alice@example.com',
        role: 'participant',
        createdAt: serverTimestamp(),
        isAdmin: true,
      }),
    )
  })

  it('does not let a user change their own role after sign-up', async () => {
    await seed(env, 'users/alice', { email: 'alice@example.com', role: 'participant' })
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertFails(updateDoc(doc(db, 'users/alice'), { role: 'clubMember' }))
  })

  it('does not let a user delete their own profile', async () => {
    await seed(env, 'users/alice', { email: 'alice@example.com', role: 'participant' })
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertFails(deleteDoc(doc(db, 'users/alice')))
  })

  it("lets a user read their own profile but not someone else's", async () => {
    await seed(env, 'users/alice', { email: 'alice@example.com', role: 'participant' })
    await seed(env, 'users/bob', { email: 'bob@example.com', role: 'clubMember' })
    const db = signedInAs(env, 'alice', 'alice@example.com')

    await assertSucceeds(getDoc(doc(db, 'users/alice')))
    await assertFails(getDoc(doc(db, 'users/bob')))
  })

  it('does not let signed-out visitors read any profile', async () => {
    await seed(env, 'users/alice', { email: 'alice@example.com', role: 'participant' })

    await assertFails(getDoc(doc(signedOut(env), 'users/alice')))
  })
})
