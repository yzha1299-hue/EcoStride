import { unauthenticated } from './errors.js'

// Who is calling: the Firebase ID token from `Authorization: Bearer <token>`,
// verified by the Admin SDK (signature against Google's keys, issuer,
// audience = this project, expiry). The caller's email always comes from the
// verified token, never from a request body.
export function bearerToken(header) {
  const match = /^Bearer (\S+)$/.exec(header ?? '')
  return match ? match[1] : null
}

export async function verifyCaller(auth, authorizationHeader) {
  const token = bearerToken(authorizationHeader)
  if (!token) {
    throw unauthenticated()
  }
  let decoded
  try {
    decoded = await auth.verifyIdToken(token)
  } catch (error) {
    if (error?.code === 'auth/id-token-expired') {
      throw unauthenticated('Your session has expired. Please sign in again.')
    }
    throw unauthenticated('Your sign-in could not be verified. Please sign in again.')
  }
  return {
    uid: decoded.uid,
    email: typeof decoded.email === 'string' ? decoded.email : null,
    emailVerified: decoded.email_verified === true,
  }
}
