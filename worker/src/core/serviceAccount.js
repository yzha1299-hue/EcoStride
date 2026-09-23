import { importPKCS8, SignJWT } from 'jose'
import { fetchUpstream } from './upstream.js'

// Exchanges the service account's private key for a short-lived Google OAuth
// access token (the "JWT bearer" grant) - what firebase-admin does internally.
// The account should hold only the "Cloud Datastore User" role: enough to read
// and write Firestore documents, nothing else in the project.
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/datastore'
const REFRESH_MARGIN_MS = 5 * 60 * 1000

// Tokens last an hour. Signing a fresh one costs RSA CPU time (the free Workers
// plan allows ~10 ms of CPU per request), so it is cached per isolate and
// concurrent requests share one in-flight refresh.
let cached = null
let pending = null

export function parseServiceAccount(raw) {
  let account
  try {
    account = JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.')
  }
  if (!account.client_email || !account.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is missing client_email or private_key.')
  }
  return account
}

async function requestToken(account) {
  const key = await importPKCS8(account.private_key, 'RS256')
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: account.private_key_id })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)

  const response = await fetchUpstream('Google sign-in service', TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  const { access_token: token, expires_in: expiresIn } = await response.json()

  return { token, clientEmail: account.client_email, expiresAt: Date.now() + expiresIn * 1000 }
}

export async function getAccessToken(account) {
  const fresh =
    cached &&
    cached.clientEmail === account.client_email &&
    cached.expiresAt - REFRESH_MARGIN_MS > Date.now()
  if (fresh) {
    return cached.token
  }

  if (!pending) {
    pending = requestToken(account)
      .then((result) => {
        cached = result
        return result
      })
      .finally(() => {
        pending = null
      })
  }
  return (await pending).token
}
