import { fetchUpstream } from './upstream.js'

// Minimal Firestore REST client. The service account bypasses security rules,
// so every handler must do its own authorisation checks before reading or
// writing on a user's behalf.

// Firestore REST wraps every value in a type tag ({ stringValue: 'x' }); this
// turns a document's fields back into plain JavaScript values.
export function decodeValue(value) {
  if ('stringValue' in value) return value.stringValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('booleanValue' in value) return value.booleanValue
  if ('timestampValue' in value) return new Date(value.timestampValue)
  if ('nullValue' in value) return null
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {})
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue)
  if ('geoPointValue' in value) return value.geoPointValue
  if ('referenceValue' in value) return value.referenceValue
  throw new Error(`Unsupported Firestore value: ${Object.keys(value).join(', ')}`)
}

export function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]))
}

// The reverse of decodeValue, for the value types handlers write.
export function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Number.isInteger(value)) return { integerValue: String(value) }
  if (typeof value === 'number') return { doubleValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  return { mapValue: { fields: encodeFields(value) } }
}

export function encodeFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]))
}

// Thrown when a commit's precondition fails (the document changed since it was
// read, or already exists / no longer exists). Callers re-read and retry.
export class PreconditionFailed extends Error {}

// Runs a read-check-commit `attempt`, re-running it from a fresh read when its
// commit's precondition fails (someone else changed the data in between), up
// to `retries` more times. Then gives up with `conflictError()`.
export async function retryOnConflict(attempt, conflictError, retries = 3) {
  for (let tries = 0; tries <= retries; tries += 1) {
    try {
      return await attempt()
    } catch (error) {
      if (!(error instanceof PreconditionFailed)) {
        throw error
      }
    }
  }
  throw conflictError()
}

export function createFirestore({ projectId, getToken }) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

  async function authHeaders() {
    return { Authorization: `Bearer ${await getToken()}` }
  }

  // Returns { id, data, updateTime } or null when the document doesn't exist.
  // updateTime is what later tickets use as a precondition for atomic writes.
  async function getDocument(path) {
    const response = await fetchUpstream(
      'Firestore',
      `${base}/${path}`,
      { headers: await authHeaders() },
      { allowStatuses: [404] },
    )
    if (response.status === 404) {
      return null
    }
    const doc = await response.json()
    return {
      id: doc.name.split('/').pop(),
      data: decodeFields(doc.fields || {}),
      updateTime: doc.updateTime,
    }
  }

  // Every document directly inside a collection, following Firestore's pages.
  async function listDocuments(collectionPath) {
    const documents = []
    let pageToken = ''
    do {
      const params = new URLSearchParams({ pageSize: '300' })
      if (pageToken) params.set('pageToken', pageToken)
      const response = await fetchUpstream('Firestore', `${base}/${collectionPath}?${params}`, {
        headers: await authHeaders(),
      })
      const page = await response.json()
      for (const doc of page.documents || []) {
        documents.push({ id: doc.name.split('/').pop(), data: decodeFields(doc.fields || {}), updateTime: doc.updateTime })
      }
      pageToken = page.nextPageToken || ''
    } while (pageToken)
    return documents
  }

  // Full resource name, as commit writes and preconditions refer to documents.
  function documentName(path) {
    return `projects/${projectId}/databases/(default)/documents/${path}`
  }

  // Applies all writes atomically: either every write lands or none does. Each
  // write may carry a `currentDocument` precondition ({ exists } or
  // { updateTime }); if any fails, nothing is written and PreconditionFailed is
  // thrown.
  async function commit(writes) {
    const response = await fetchUpstream(
      'Firestore',
      `${base}:commit`,
      {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ writes }),
      },
      { allowStatuses: [400, 404, 409] },
    )
    if (response.ok) {
      return response.json()
    }
    // A failed precondition comes back as 400 FAILED_PRECONDITION (updateTime
    // changed), 409 ALREADY_EXISTS ({ exists: false }) or 404 NOT_FOUND
    // ({ exists: true }). Under heavy contention Firestore may instead give up
    // with 409 ABORTED; that is just as safe to retry. Anything else is a
    // genuine error.
    const payload = await response.json().catch(() => null)
    const status = payload?.error?.status
    if (['FAILED_PRECONDITION', 'ALREADY_EXISTS', 'NOT_FOUND', 'ABORTED'].includes(status)) {
      throw new PreconditionFailed(status)
    }
    const error = new Error('Firestore commit failed.')
    error.upstreamStatus = response.status
    error.upstreamDetail = JSON.stringify(payload)?.slice(0, 500)
    throw error
  }

  return { getDocument, listDocuments, documentName, commit }
}
