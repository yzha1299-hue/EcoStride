import { beforeEach, describe, expect, it } from 'vitest'
import { api, db, resetEmulators, signedInUser } from './apiEnv'

// Admins approve or decline requests to become a club member. Only the server
// can change a role, so these endpoints are the one way a participant becomes
// a club member.
let ada // admin

beforeEach(async () => {
  await resetEmulators()
  ada = await signedInUser('ada')
  await db.doc('users/ada').set({ email: 'ada@example.com', role: 'admin' })
  await db.doc('users/paul').set({ email: 'paul@example.com', role: 'participant', clubRequest: 'pending' })
})

const decide = (action, user, uid = 'paul') =>
  api(`/admin/club-requests/${action}`, { method: 'POST', token: user?.token, body: { uid } })
const profile = async (uid) => (await db.doc(`users/${uid}`).get()).data()

describe.each(['approve', 'decline'])('POST /api/admin/club-requests/%s', (action) => {
  it('needs a signed-in caller', async () => {
    const response = await decide(action, null)

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it.each([
    ['a participant', 'participant'],
    ['a club member', 'clubMember'],
    ['an account with no profile', null],
  ])('refuses %s', async (_who, role) => {
    const user = await signedInUser('mallory')
    if (role) await db.doc('users/mallory').set({ email: 'mallory@example.com', role })

    const response = await decide(action, user)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('NOT_ADMIN')
    expect(await profile('paul')).toMatchObject({ role: 'participant', clubRequest: 'pending' })
  })

  it.each([{}, { uid: '' }, { uid: '../users/x' }, { uid: 'paul', role: 'admin' }])('refuses the body %j', async (body) => {
    const response = await api(`/admin/club-requests/${action}`, { method: 'POST', token: ada.token, body })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
  })

  it('reports a person who does not exist', async () => {
    const response = await decide(action, ada, 'nobody')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })

  it.each([
    ['has no request', { role: 'participant' }],
    ['is already a club member', { role: 'clubMember' }],
    ['is an admin', { role: 'admin' }],
    ['was already declined', { role: 'participant', clubRequest: 'declined' }],
  ])('refuses someone who %s', async (_what, data) => {
    await db.doc('users/quinn').set({ email: 'quinn@example.com', ...data })

    const response = await decide(action, ada, 'quinn')

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('NO_PENDING_REQUEST')
    expect(await profile('quinn')).toMatchObject(data)
  })
})

describe('approving', () => {
  it('makes the participant a club member and clears the request', async () => {
    const response = await decide('approve', ada)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ uid: 'paul', role: 'clubMember' })
    const stored = await profile('paul')
    expect(stored).toMatchObject({ email: 'paul@example.com', role: 'clubMember', clubDecidedBy: 'ada' })
    expect(stored).not.toHaveProperty('clubRequest')
    expect(stored.clubDecidedAt.toDate()).toBeInstanceOf(Date)
  })

  it('cannot be done twice', async () => {
    await decide('approve', ada)

    const again = await decide('approve', ada)

    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('NO_PENDING_REQUEST')
  })
})

describe('declining', () => {
  it('keeps the person a participant and records the decision', async () => {
    const response = await decide('decline', ada)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ uid: 'paul', clubRequest: 'declined' })
    expect(await profile('paul')).toMatchObject({ role: 'participant', clubRequest: 'declined', clubDecidedBy: 'ada' })
  })

  it('cannot be approved afterwards', async () => {
    await decide('decline', ada)

    const response = await decide('approve', ada)

    expect(response.status).toBe(409)
    expect((await profile('paul')).role).toBe('participant')
  })
})
