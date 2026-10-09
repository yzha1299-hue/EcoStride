// "Who am I": echoes the verified identity and reads the caller's profile -
// proof that token verification and Firestore access both work end to end.
//
// Handlers are platform-agnostic: plain async functions from
// { user, body, deps } to a JSON-serialisable result. They never touch the
// platform's request or response objects.
export async function me({ user, deps }) {
  const profile = await deps.db.doc(`users/${user.uid}`).get()

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    role: profile.exists ? (profile.get('role') ?? null) : null,
  }
}
