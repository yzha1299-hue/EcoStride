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

  return { getDocument }
}
