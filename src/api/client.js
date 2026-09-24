import { getAuth } from 'firebase/auth'
import { refreshVerification } from '../auth/authState'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

// Mirrors the Worker's error shape so views can branch on `code`
// (e.g. EVENT_FULL) and show `message` to the user.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function apiFetch(path, options = {}) {
  try {
    return await send(path, options)
  } catch (error) {
    // A token issued before the user verified their email still says
    // "unverified". If the account is verified by now, a fresh token fixes it.
    if (error.code === 'EMAIL_NOT_VERIFIED' && (await refreshVerification().catch(() => false))) {
      return send(path, options)
    }
    throw error
  }
}

async function send(path, { method = 'GET', body } = {}) {
  const currentUser = getAuth().currentUser
  if (!currentUser) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.')
  }
  // getIdToken() returns the cached token and refreshes it only when near expiry.
  const token = await currentUser.getIdToken()

  const init = { method, headers: { Authorization: `Bearer ${token}` } }
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, init)
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'We could not reach the server. Check your connection and try again.')
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code || 'UNKNOWN',
      payload?.error?.message || 'Something went wrong. Please try again.',
    )
  }
  return payload
}

export const getMe = () => apiFetch('/me')

export const registerForEvent = (eventId, { name, needs }) =>
  apiFetch('/registrations', { method: 'POST', body: { eventId, name, needs: needs || undefined } })

export const cancelRegistration = (eventId) =>
  apiFetch('/registrations/cancel', { method: 'POST', body: { eventId } })

export const emailRosterToMe = (eventId) => apiFetch('/events/roster-email', { method: 'POST', body: { eventId } })

// `attachment`: optional { name, type, base64 }.
export const emailRegistrants = (eventId, { subject, message, attachment }) =>
  apiFetch('/events/email-registrants', {
    method: 'POST',
    body: {
      eventId,
      subject,
      message,
      attachmentName: attachment?.name,
      attachmentType: attachment?.type,
      attachmentData: attachment?.base64,
    },
  })
