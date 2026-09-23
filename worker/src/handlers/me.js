// "Who am I": echoes the verified identity and reads the caller's profile with
// the service account - proof that token verification and Firestore access
// both work end to end.
//
// Handlers are platform-agnostic: plain async functions from
// { user, body, deps } to a JSON-serialisable result. They never touch
// Request/Response or Worker bindings, so they could run behind any runtime.
export async function me({ user, deps }) {
  const profile = await deps.firestore.getDocument(`users/${user.uid}`)

  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    role: profile?.data.role ?? null,
  }
}
