import { beforeEach, describe, expect, it } from 'vitest'
import { api, db, resetEmulators, seedEvent, signedInUser } from './apiEnv'

// The two email endpoints, through the real API function on the emulators.
// No Brevo secrets are set here, so a request that passes every check ends in
// EMAIL_UNAVAILABLE: the refusals below must all happen before that point,
// and nothing is ever sent to the email provider.
let clara

beforeEach(async () => {
  await resetEmulators()
  clara = await signedInUser('clara', { email: 'clara@example.com' })
})

const roster = (user, eventId = 'e1') =>
  api('/events/roster-email', { method: 'POST', token: user?.token, body: { eventId } })
const emailRegistrants = (user, extra = {}) =>
  api('/events/email-registrants', {
    method: 'POST',
    token: user?.token,
    body: { eventId: 'e1', subject: 'Venue change', message: 'See you at the hall.', ...extra },
  })
const seedRegistrant = (uid = 'rita') =>
  db.doc(`events/e1/registrations/${uid}`).set({
    name: 'Rita R',
    email: `${uid}@example.com`,
    needs: '',
    registeredAt: new Date(),
  })
const emailLimitDocs = async () => (await db.collection('emailRateLimits').get()).docs

// A 12-byte stand-in with a real PNG signature.
const PNG = 'iVBORw0KGgoAAAAA'

describe.each([
  ['POST /api/events/roster-email', roster],
  ['POST /api/events/email-registrants', emailRegistrants],
])('%s', (_name, call) => {
  it('needs a signed-in caller', async () => {
    await seedEvent('e1')

    const response = await call(null)

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('refuses a caller whose email is not verified', async () => {
    await seedEvent('e1')
    const paul = await signedInUser('paul', { emailVerified: false })

    const response = await call(paul)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('refuses someone who did not create the event', async () => {
    await seedEvent('e1', { createdBy: 'someone-else' })
    await seedRegistrant()

    const response = await call(clara)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('NOT_OWNER')
  })

  it('reports an event that does not exist', async () => {
    const response = await call(clara)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})

describe('POST /api/events/roster-email', () => {
  it('reaches the email provider only after every check passes', async () => {
    await seedEvent('e1')
    await seedRegistrant()

    const response = await roster(clara)

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('EMAIL_UNAVAILABLE')
  })
})

describe('POST /api/events/email-registrants', () => {
  it('refuses when nobody has registered, without using up the daily limit', async () => {
    await seedEvent('e1')

    const response = await emailRegistrants(clara)

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('NO_RECIPIENTS')
    expect(await emailLimitDocs()).toHaveLength(0)
  })

  it.each([
    ['an incomplete attachment', { attachmentName: 'flyer.png' }],
    ['a disallowed type', { attachmentName: 'run.exe', attachmentType: 'application/x-msdownload', attachmentData: PNG }],
    ['contents that do not match the type', { attachmentName: 'flyer.pdf', attachmentType: 'application/pdf', attachmentData: PNG }],
    ['data that is not base64', { attachmentName: 'flyer.png', attachmentType: 'image/png', attachmentData: 'not base64!' }],
    ['a file over 2 MB', { attachmentName: 'flyer.png', attachmentType: 'image/png', attachmentData: PNG + 'A'.repeat(2_800_000 - PNG.length) }],
  ])('refuses %s', async (_what, attachment) => {
    await seedEvent('e1')
    await seedRegistrant()

    const response = await emailRegistrants(clara, attachment)

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('ATTACHMENT_INVALID')
    expect(await emailLimitDocs()).toHaveLength(0)
  })

  it('accepts a request body up to 3 MB and refuses a larger one', async () => {
    await seedEvent('e1')
    await seedRegistrant()

    const big = await emailRegistrants(clara, { message: 'x'.repeat(3_100_000) })

    expect(big.status).toBe(413)
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('gives the day\'s slot back when the email cannot be sent', async () => {
    await seedEvent('e1')
    await seedRegistrant()

    const response = await emailRegistrants(clara, {
      attachmentName: 'flyer.png',
      attachmentType: 'image/png',
      attachmentData: PNG,
    })

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('EMAIL_UNAVAILABLE')
    const [record] = await emailLimitDocs()
    expect(record.get('count')).toBe(0)
  })

  it('stops after five emails about one event in a day', async () => {
    await seedEvent('e1')
    await seedRegistrant()
    const melbourneDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', dateStyle: 'short' }).format(new Date())
    await db.doc(`emailRateLimits/e1_${melbourneDay}`).set({ eventId: 'e1', day: melbourneDay, count: 5 })

    const response = await emailRegistrants(clara)

    expect(response.status).toBe(429)
    expect(response.body.error.code).toBe('RATE_LIMITED')
  })
})
