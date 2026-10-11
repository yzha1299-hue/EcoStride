// Rows for the admin page's "Club member requests" list, from the pending
// profiles ({ uid, data }): the person's email and when they signed up, the
// longest wait first. A profile with no date goes last rather than breaking
// the list.
export function pendingRequestRows(profiles) {
  return profiles
    .map(({ uid, data }) => ({ uid, email: data.email ?? '', requestedAt: data.createdAt ?? null }))
    .sort((a, b) => (a.requestedAt?.getTime() ?? Infinity) - (b.requestedAt?.getTime() ?? Infinity))
}
