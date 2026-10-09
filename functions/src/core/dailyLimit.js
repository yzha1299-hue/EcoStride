import { ApiError } from './errors.js'
import { encodeFields, retryOnConflict } from './firestore.js'

// "At most N per Melbourne day" counters, stored in Firestore so every Worker
// isolate sees the same count, e.g. emailRateLimits/bike-basics_2026-09-24.
// Taking a slot and counting it happen in one preconditioned commit, so two
// requests at the same moment can't both take the last slot. The collections
// are server-only: security rules deny clients any access.
const melbourneDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Melbourne', dateStyle: 'short' })

// Returns { path, remaining }, or throws RATE_LIMITED with `limitMessage`.
// `fields` are stored alongside the count when the day's record is created.
export async function reserveDailySlot(firestore, { collection, key, limit, limitMessage, fields = {}, now = new Date() }) {
  const day = melbourneDay.format(now)
  const path = `${collection}/${key}_${day}`
  return retryOnConflict(
    async () => {
      const record = await firestore.getDocument(path)
      const used = record?.data.count ?? 0
      if (used >= limit) {
        throw new ApiError(429, 'RATE_LIMITED', limitMessage)
      }
      const name = firestore.documentName(path)
      await firestore.commit([
        record
          ? {
              transform: { document: name, fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }] },
              currentDocument: { updateTime: record.updateTime },
            }
          : { update: { name, fields: encodeFields({ ...fields, day, count: 1 }) }, currentDocument: { exists: false } },
      ])
      return { path, remaining: limit - used - 1 }
    },
    () => new ApiError(409, 'CONFLICT', 'Another request is using the same allowance right now. Please try again.'),
  )
}

// Gives a slot back when the work it was reserved for failed. Best effort: if
// this fails too, the worst case is one slot lost for the day.
export async function releaseDailySlot(firestore, path) {
  try {
    await firestore.commit([
      {
        transform: {
          document: firestore.documentName(path),
          fieldTransforms: [{ fieldPath: 'count', increment: { integerValue: '-1' } }],
        },
      },
    ])
  } catch {
    // Ignored; see above.
  }
}
