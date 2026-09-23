import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import { unauthenticated } from './errors.js'

// Firebase ID tokens are RS256 JWTs signed by Google's "securetoken" service.
// firebase-admin can't run on Workers, so the checks it would do are done here:
// signature against Google's published keys, issuer, audience, expiry, subject.
const SECURETOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

// Module scope = one key set per Worker isolate, reused across requests. jose
// caches the fetched keys and only refetches when it meets an unknown key id,
// so a typical request verifies with no network call at all.
const jwks = createRemoteJWKSet(new URL(SECURETOKEN_JWKS_URL), {
  timeoutDuration: 5000,
  cooldownDuration: 30_000,
})

export function bearerToken(request) {
  const header = request.headers.get('Authorization') || ''
  const match = /^Bearer (\S+)$/.exec(header)
  return match ? match[1] : null
}

export async function verifyIdToken(token, projectId) {
  if (!token) {
    throw unauthenticated()
  }

  let payload
  try {
    ;({ payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    }))
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw unauthenticated('Your session has expired. Please sign in again.')
    }
    throw unauthenticated('Your sign-in could not be verified. Please sign in again.')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw unauthenticated('Your sign-in could not be verified. Please sign in again.')
  }
  if (typeof payload.auth_time !== 'number' || payload.auth_time > nowSeconds) {
    throw unauthenticated('Your sign-in could not be verified. Please sign in again.')
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    emailVerified: payload.email_verified === true,
  }
}
