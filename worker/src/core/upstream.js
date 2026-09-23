import { ApiError } from './errors.js'

// Every call to another service (Google, Firestore, Brevo, map APIs) goes
// through here, so a slow or failing dependency surfaces as a standard error
// instead of hanging the request until the platform kills it.
// `allowStatuses` lists non-2xx statuses that are normal answers, not failures
// (e.g. Firestore's 404 for a document that doesn't exist).
export async function fetchUpstream(service, url, init = {}, { timeoutMs = 8000, allowStatuses = [] } = {}) {
  let response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new ApiError(504, 'UPSTREAM_TIMEOUT', `${service} took too long to respond.`)
    }
    throw new ApiError(502, 'UPSTREAM_ERROR', `Could not reach ${service}.`)
  }

  if (!response.ok && !allowStatuses.includes(response.status)) {
    const detail = await response.text().catch(() => '')
    const error = new ApiError(502, 'UPSTREAM_ERROR', `${service} returned an error.`)
    // Kept for server logs only; never sent to the client.
    error.upstreamStatus = response.status
    error.upstreamDetail = detail.slice(0, 500)
    throw error
  }

  return response
}
