import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Helpers for API integration tests. They run under
//   firebase emulators:exec --only functions,firestore,auth --project demo-ecostride
// which starts the API function and points the Admin SDK at the emulators
// (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST). The "demo-" project
// keeps everything offline: it can never touch the real project.
export const PROJECT_ID = 'demo-ecostride'
const REGION = 'australia-southeast1'
const FUNCTIONS = `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}/api`
const AUTH = 'http://127.0.0.1:9099'
const FIRESTORE = 'http://127.0.0.1:8080'

if (!getApps().length) {
  initializeApp({ projectId: PROJECT_ID })
}
export const db = getFirestore()
const auth = getAuth()

// Empties Firestore and Auth between tests.
export async function resetEmulators() {
  await Promise.all([
    fetch(`${FIRESTORE}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' }),
    fetch(`${AUTH}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: 'DELETE' }),
  ])
}

// Creates an Auth-emulator user and returns a real ID token for them.
export async function signedInUser(uid, { email = `${uid}@example.com`, emailVerified = true } = {}) {
  const password = 'test-password-123'
  await auth.createUser({ uid, email, emailVerified, password })
  const response = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const { idToken } = await response.json()
  return { uid, email, token: idToken }
}

const HOUR = 60 * 60 * 1000

// Stores an event as the app's event form would, starting a week from now
// unless overridden. Dates are stored as Firestore timestamps.
export async function seedEvent(id, overrides = {}) {
  const startsAt = overrides.startsAt ?? new Date(Date.now() + 7 * 24 * HOUR)
  await db.doc(`events/${id}`).set({
    title: 'Bike maintenance basics',
    type: 'Workshop',
    venue: 'Brunswick Town Hall',
    address: '233 Sydney Rd, Brunswick VIC 3056',
    capacity: 10,
    registeredCount: 0,
    status: 'open',
    createdBy: 'clara',
    startsAt,
    endsAt: new Date(startsAt.getTime() + 2 * HOUR),
    ...overrides,
  })
}

// Calls the API as the site does: paths start with /api, exactly as they
// arrive through the Hosting rewrite in production.
export async function api(path, { method = 'GET', token, body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } }
  if (token) init.headers.Authorization = `Bearer ${token}`
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = typeof body === 'string' ? body : JSON.stringify(body)
  }
  const response = await fetch(`${FUNCTIONS}/api${path}`, init)
  const text = await response.text()
  return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null }
}
