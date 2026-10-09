import { beforeEach, describe, expect, it } from 'vitest'
import { api, db, resetEmulators, seedEvent, signedInUser } from './apiEnv'

// Registration and cancellation: every rule, and the capacity cap under
// concurrent requests, through the real API function on the emulators.
let rita

beforeEach(async () => {
  await resetEmulators()
  rita = await signedInUser('rita', { email: 'rita@example.com' })
})

const register = (user, body) => api('/registrations', { method: 'POST', token: user.token, body })
const cancel = (user, eventId) => api('/registrations/cancel', { method: 'POST', token: user.token, body: { eventId } })
const count = async (eventId) => (await db.doc(`events/${eventId}`).get()).get('registeredCount')
const registrationIds = async (eventId) => (await db.collection(`events/${eventId}/registrations`).get()).docs.map((d) => d.id)

describe('POST /api/registrations', () => {
  it('registers the caller and counts the place', async () => {
    await seedEvent('e1', { capacity: 10, registeredCount: 2 })

    const response = await register(rita, { eventId: 'e1', name: 'Rita R', needs: 'Step-free access' })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ eventId: 'e1', registered: true, registeredCount: 3 })
    expect(await count('e1')).toBe(3)
    const stored = (await db.doc('events/e1/registrations/rita').get()).data()
    expect(stored).toMatchObject({ name: 'Rita R', needs: 'Step-free access', email: 'rita@example.com' })
    expect(stored.registeredAt.toDate()).toBeInstanceOf(Date)
  })

  it('takes the email from the sign-in token and rejects one sent in the body', async () => {
    await seedEvent('e1')

    const response = await register(rita, { eventId: 'e1', name: 'Rita', email: 'someone-else@example.com' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
    expect(await registrationIds('e1')).toEqual([])
  })

  it('needs a signed-in caller and a valid body', async () => {
    await seedEvent('e1')

    expect((await api('/registrations', { method: 'POST', body: { eventId: 'e1', name: 'Rita' } })).status).toBe(401)
    expect((await register(rita, { eventId: 'e1' })).body.error.code).toBe('INVALID_REQUEST')
    expect((await register(rita, { eventId: '../users/x', name: 'Rita' })).body.error.code).toBe('INVALID_REQUEST')
  })

  it.each([
    ['NOT_FOUND', 404, null, {}],
    ['EVENT_CANCELLED', 409, 'e1', { status: 'cancelled' }],
    ['EVENT_CLOSED', 409, 'e1', { startsAt: new Date(Date.now() - 60_000) }],
    ['OWN_EVENT', 403, 'e1', { createdBy: 'rita' }],
    ['EVENT_FULL', 409, 'e1', { capacity: 5, registeredCount: 5 }],
  ])('refuses with %s', async (code, status, eventId, overrides) => {
    if (eventId) await seedEvent(eventId, overrides)

    const response = await register(rita, { eventId: eventId ?? 'missing', name: 'Rita' })

    expect(response.status).toBe(status)
    expect(response.body.error.code).toBe(code)
    if (eventId) expect(await registrationIds(eventId)).toEqual([])
  })

  it('refuses a second registration by the same person', async () => {
    await seedEvent('e1')
    await register(rita, { eventId: 'e1', name: 'Rita' })

    const response = await register(rita, { eventId: 'e1', name: 'Rita' })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('ALREADY_REGISTERED')
    expect(await count('e1')).toBe(1)
  })

  it('never over-books when more people race for the places than there are', { timeout: 90_000 }, async () => {
    await seedEvent('race', { capacity: 3 })
    const people = []
    for (let i = 0; i < 12; i += 1) people.push(await signedInUser(`racer${i}`))

    const responses = await Promise.all(people.map((person) => register(person, { eventId: 'race', name: person.uid })))

    const outcomes = responses.map((r) => (r.status === 200 ? 'ok' : r.body.error.code))
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(3)
    expect(outcomes.filter((o) => o !== 'ok').every((o) => o === 'EVENT_FULL')).toBe(true)
    expect(await count('race')).toBe(3)
    expect(await registrationIds('race')).toHaveLength(3)
  })
})

describe('POST /api/registrations/cancel', () => {
  it('removes the registration and frees the place', async () => {
    await seedEvent('e1', { registeredCount: 4 })
    await db.doc('events/e1/registrations/rita').set({ name: 'Rita', email: 'rita@example.com' })

    const response = await cancel(rita, 'e1')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ eventId: 'e1', registered: false, registeredCount: 3 })
    expect(await count('e1')).toBe(3)
    expect(await registrationIds('e1')).toEqual([])
  })

  it('refuses when the caller is not registered', async () => {
    await seedEvent('e1', { registeredCount: 1 })

    const response = await cancel(rita, 'e1')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_REGISTERED')
    expect(await count('e1')).toBe(1)
  })

  it('refuses once the event has started', async () => {
    await seedEvent('e1', { registeredCount: 1, startsAt: new Date(Date.now() - 60_000) })
    await db.doc('events/e1/registrations/rita').set({ name: 'Rita' })

    const response = await cancel(rita, 'e1')

    expect(response.body.error.code).toBe('EVENT_CLOSED')
    expect(await count('e1')).toBe(1)
  })

  it('frees the place only once when the same person cancels twice at the same moment', async () => {
    await seedEvent('e1', { registeredCount: 5 })
    await db.doc('events/e1/registrations/rita').set({ name: 'Rita' })

    const responses = await Promise.all([cancel(rita, 'e1'), cancel(rita, 'e1')])

    const outcomes = responses.map((r) => (r.status === 200 ? 'ok' : r.body.error.code)).sort()
    expect(outcomes).toEqual(['NOT_REGISTERED', 'ok'])
    expect(await count('e1')).toBe(4)
  })
})
