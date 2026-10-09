import { Timestamp } from 'firebase-admin/firestore'

// Firestore returns Timestamps; the rest of the code (event state, emails,
// the public API) works with Dates. Converting at this one boundary keeps
// Firestore types out of the handlers' logic.
export function plainData(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot.data() ?? {}).map(([key, value]) => [
      key,
      value instanceof Timestamp ? value.toDate() : value,
    ]),
  )
}

// Firestore gives up on a transaction that keeps colliding with others
// (gRPC status ABORTED); the caller turns that into a friendly 409.
export function isContention(error) {
  return error?.code === 10 || error?.code === 'aborted' || /ABORTED/.test(error?.message ?? '')
}
