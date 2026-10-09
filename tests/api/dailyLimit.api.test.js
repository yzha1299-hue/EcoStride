import { beforeEach, describe, expect, it } from 'vitest'
import { releaseDailySlot, reserveDailySlot } from '../../functions/src/core/dailyLimit.js'
import { db, resetEmulators } from './apiEnv'

// The "N per Melbourne day" counter behind the bulk-email and AI-draft limits,
// against the Firestore emulator.
const NOW = new Date('2026-10-09T03:00:00Z') // 2 pm on 9 Oct in Melbourne

const reserve = () =>
  reserveDailySlot(db, {
    collection: 'emailRateLimits',
    key: 'e1',
    limit: 5,
    limitMessage: 'Daily limit reached.',
    fields: { eventId: 'e1' },
    now: NOW,
  }).then(
    (slot) => ['ok', slot],
    (error) => [error.code, error.message],
  )

beforeEach(async () => {
  await resetEmulators()
})

describe('reserveDailySlot', () => {
  it('counts uses in one record per key per Melbourne day and reports what is left', async () => {
    const [outcome, slot] = await reserve()

    expect(outcome).toBe('ok')
    expect(slot).toEqual({ path: 'emailRateLimits/e1_2026-10-09', remaining: 4 })
    expect((await db.doc(slot.path).get()).data()).toEqual({ eventId: 'e1', day: '2026-10-09', count: 1 })
  })

  it('refuses once the limit is reached', async () => {
    await db.doc('emailRateLimits/e1_2026-10-09').set({ eventId: 'e1', day: '2026-10-09', count: 5 })

    expect(await reserve()).toEqual(['RATE_LIMITED', 'Daily limit reached.'])
  })

  it('never lets more requests through than the limit when they arrive together', async () => {
    await db.doc('emailRateLimits/e1_2026-10-09').set({ eventId: 'e1', day: '2026-10-09', count: 1 })

    const outcomes = (await Promise.all(Array.from({ length: 6 }, reserve))).map(([outcome]) => outcome)

    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(4)
    expect(outcomes.filter((o) => o !== 'ok').every((o) => o === 'RATE_LIMITED')).toBe(true)
    expect((await db.doc('emailRateLimits/e1_2026-10-09').get()).get('count')).toBe(5)
  })
})

describe('releaseDailySlot', () => {
  it('gives a slot back', async () => {
    const [, slot] = await reserve()

    await releaseDailySlot(db, slot.path)

    expect((await db.doc(slot.path).get()).get('count')).toBe(0)
  })
})
