import { isContention } from './documents.js'
import { ApiError } from './errors.js'

// "At most N per Melbourne day" counters, stored in Firestore so every
// function instance sees the same count, e.g. emailRateLimits/bike-basics_2026-09-24.
// Checking and counting happen in one transaction, so two requests at the
// same moment can't both take the last slot. The collections are
// server-only: security rules deny clients any access.
const melbourneDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', dateStyle: 'short' })

// Returns { path, remaining }, or throws RATE_LIMITED with `limitMessage`.
// `fields` are stored alongside the count when the day's record is created.
export async function reserveDailySlot(db, { collection, key, limit, limitMessage, fields = {}, now = new Date() }) {
  const day = melbourneDay.format(now)
  const ref = db.doc(`${collection}/${key}_${day}`)
  try {
    const remaining = await db.runTransaction(
      async (tx) => {
        const record = await tx.get(ref)
        const used = record.exists ? record.get('count') : 0
        if (used >= limit) {
          throw new ApiError(429, 'RATE_LIMITED', limitMessage)
        }
        // Inside the transaction the count just read is current, so the new
        // value can be written directly.
        if (record.exists) {
          tx.update(ref, { count: used + 1 })
        } else {
          tx.create(ref, { ...fields, day, count: 1 })
        }
        return limit - used - 1
      },
      { maxAttempts: 5 },
    )
    return { path: ref.path, remaining }
  } catch (error) {
    if (isContention(error)) {
      throw new ApiError(409, 'CONFLICT', 'Another request is using the same allowance right now. Please try again.')
    }
    throw error
  }
}

// Gives a slot back when the work it was reserved for failed. Best effort: if
// this fails too, the worst case is one slot lost for the day.
export async function releaseDailySlot(db, path) {
  const ref = db.doc(path)
  try {
    await db.runTransaction(async (tx) => {
      const record = await tx.get(ref)
      if (record.exists) tx.update(ref, { count: Math.max(0, record.get('count') - 1) })
    })
  } catch {
    // Ignored; see above.
  }
}
