import { beforeEach, describe, expect, it } from 'vitest'
import { api, db, resetEmulators, seedEvent, signedInUser } from './apiEnv'

// "Draft with AI", through the real API function on the emulators. The test
// project has no Gemini key or model, so a request that passes every check
// ends in AI_UNAVAILABLE and the AI service is never called.
let clara

beforeEach(async () => {
  await resetEmulators()
  clara = await signedInUser('clara')
  await db.doc('users/clara').set({ role: 'clubMember' })
})

const draft = (body, user = clara) => api('/ai/draft', { method: 'POST', token: user?.token, body })
const description = (extra = {}) => draft({ kind: 'event-description', title: 'Bike basics', ...extra })
const emailDraft = (extra = {}) => draft({ kind: 'registrant-email', eventId: 'e1', ...extra })
const usageDocs = async () => (await db.collection('aiUsage').get()).docs

describe('POST /api/ai/draft', () => {
  it('needs a signed-in caller', async () => {
    const response = await draft({ kind: 'event-description', title: 'x' }, null)

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it.each([
    ['an unknown kind', { kind: 'poem' }],
    ['an unknown field', { kind: 'event-description', title: 'x', registrations: 'all' }],
    ['a missing kind', { title: 'x' }],
  ])('refuses %s', async (_what, body) => {
    const response = await draft(body)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
  })

  describe('event-description', () => {
    it.each([
      ['a participant', { role: 'participant' }],
      ['an admin', { role: 'admin' }],
      ['an account with no profile', null],
    ])('refuses %s', async (_who, profile) => {
      const user = await signedInUser('pat')
      if (profile) await db.doc('users/pat').set(profile)

      const refused = await draft({ kind: 'event-description', title: 'Bike basics' }, user)

      expect(refused.status).toBe(403)
      expect(refused.body.error.code).toBe('NOT_CLUB_MEMBER')
      expect(await usageDocs()).toHaveLength(0)
    })

    it('needs a title', async () => {
      const response = await draft({ kind: 'event-description' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
    })

    it('gives the day\'s slot back when the AI service is not set up', async () => {
      const response = await description()

      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('AI_UNAVAILABLE')
      const [record] = await usageDocs()
      expect(record.get('count')).toBe(0)
    })
  })

  describe('registrant-email', () => {
    it('refuses someone who did not create the event', async () => {
      await seedEvent('e1', { createdBy: 'someone-else' })

      const response = await emailDraft()

      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('NOT_OWNER')
      expect(await usageDocs()).toHaveLength(0)
    })

    it('reports an event that does not exist', async () => {
      const response = await emailDraft()

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('NOT_FOUND')
    })

    it('needs an eventId', async () => {
      const response = await draft({ kind: 'registrant-email' })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_REQUEST')
    })

    it('reaches the AI service only after every check passes', async () => {
      await seedEvent('e1')

      const response = await emailDraft({ instructions: 'Mention the venue change' })

      expect(response.status).toBe(503)
      expect(response.body.error.code).toBe('AI_UNAVAILABLE')
    })
  })

  it('stops after 20 drafts by one person in a day', async () => {
    const melbourneDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', dateStyle: 'short' }).format(new Date())
    await db.doc(`aiUsage/clara_${melbourneDay}`).set({ day: melbourneDay, count: 20 })

    const response = await description()

    expect(response.status).toBe(429)
    expect(response.body.error.code).toBe('RATE_LIMITED')
  })
})
