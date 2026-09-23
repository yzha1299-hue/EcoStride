import { getAuth } from 'firebase/auth'

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

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const currentUser = getAuth().currentUser
  if (!currentUser) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.')
  }
  // getIdToken() returns the cached token and refreshes it only when near expiry.
  const token = await currentUser.getIdToken()

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
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
