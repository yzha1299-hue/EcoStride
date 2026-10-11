import { FieldValue } from 'firebase-admin/firestore'
import { isContention } from '../core/documents.js'
import { ApiError, notAdmin, notFound } from '../core/errors.js'
import { USER_ID } from '../core/validate.js'

// Becoming a club member needs an admin's approval. A new account is a
// participant with `clubRequest: 'pending'` on its profile; here an admin
// approves it (the role becomes clubMember) or declines it. This is the only
// place a role is ever changed from the app: security rules forbid every
// client write to a profile, so nobody can approve themselves.
export const clubRequestSchema = { uid: USER_ID }

async function requireAdmin(db, uid) {
  const profile = await db.doc(`users/${uid}`).get()
  if (profile.get('role') !== 'admin') throw notAdmin()
}

// Runs `change` on the person's profile if they have a pending request, in a
// transaction so two admins deciding at once can't both act.
async function decide({ user, body, deps }, change) {
  const { db } = deps
  await requireAdmin(db, user.uid)
  const ref = db.doc(`users/${body.uid}`)
  try {
    return await db.runTransaction(
      async (tx) => {
        const snapshot = await tx.get(ref)
        if (!snapshot.exists) throw notFound('There is no such person.')
        if (snapshot.get('role') !== 'participant' || snapshot.get('clubRequest') !== 'pending') {
          throw new ApiError(409, 'NO_PENDING_REQUEST', 'This person has no club member request waiting for a decision.')
        }
        tx.update(ref, { ...change, clubDecidedAt: FieldValue.serverTimestamp(), clubDecidedBy: user.uid })
        return body.uid
      },
      { maxAttempts: 5 },
    )
  } catch (error) {
    if (isContention(error)) {
      throw new ApiError(409, 'CONFLICT', 'Someone else is deciding this request right now. Please try again.')
    }
    throw error
  }
}

export async function approveClubRequest(request) {
  const uid = await decide(request, { role: 'clubMember', clubRequest: FieldValue.delete() })
  return { uid, role: 'clubMember' }
}

export async function declineClubRequest(request) {
  const uid = await decide(request, { clubRequest: 'declined' })
  return { uid, clubRequest: 'declined' }
}
