import { computed, ref } from 'vue'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { signUpProfileFields } from './signUpProfile'

export const ROLES = {
  PARTICIPANT: 'participant',
  CLUB_MEMBER: 'clubMember',
  // Charity staff; granted only by scripts/make-admin.mjs, never at sign-up.
  ADMIN: 'admin',
}

export const ROLE_LABELS = {
  [ROLES.PARTICIPANT]: 'Participant',
  [ROLES.CLUB_MEMBER]: 'Club member',
  [ROLES.ADMIN]: 'Admin',
}

export const user = ref(null)
export const role = ref('')
// A participant's request to become a club member: 'pending' while it waits
// for an admin, 'declined' if it was refused, '' if there is none. Approving
// it changes the role itself, so there is no 'approved' state.
export const clubRequest = ref('')
// Whether the signed-in user has a users/{uid} Firestore document yet. Accounts
// created before the Firestore-backed role system existed (or otherwise missing
// a profile) have no doc, so the router sends them to /complete-profile instead
// of silently defaulting them to "participant".
export const hasProfile = ref(false)
// Mirrors user.emailVerified. Firebase only refreshes that flag on reload(), so
// it is kept in its own ref that refreshVerification() can update reactively.
export const emailVerified = ref(false)

let resolveAuthReady
export const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve
})

async function fetchProfile(firebaseUser) {
  const snapshot = await getDoc(doc(getFirestore(), 'users', firebaseUser.uid))
  const storedRole = snapshot.data()?.role
  const resolvedRole = Object.values(ROLES).includes(storedRole) ? storedRole : ROLES.PARTICIPANT
  const storedRequest = snapshot.data()?.clubRequest
  const request = storedRequest === 'pending' || storedRequest === 'declined' ? storedRequest : ''

  return { role: resolvedRole, clubRequest: request, exists: snapshot.exists() }
}

// The user's role lives in Firestore (users/{uid}), not on the client. Firestore
// security rules let a user create that document once, for themselves, with a
// valid role value, and forbid any update/delete afterwards - so a signed-in
// client cannot escalate its own privileges by editing local state.
export async function resolveRole(firebaseUser) {
  if (!firebaseUser) {
    return ''
  }

  const { role: resolvedRole } = await fetchProfile(firebaseUser)
  return resolvedRole
}

// Refreshes both role and hasProfile from Firestore in a single read, and
// updates the shared reactive state used by the router guard.
export async function syncProfileState(firebaseUser) {
  if (!firebaseUser) {
    role.value = ''
    clubRequest.value = ''
    hasProfile.value = false
    return
  }

  const { role: resolvedRole, clubRequest: request, exists } = await fetchProfile(firebaseUser)
  role.value = resolvedRole
  clubRequest.value = request
  hasProfile.value = exists
}

// Creates the account's profile from the role the person chose. Club member
// isn't granted here: the account is a participant with a pending request.
export async function createUserProfile(firebaseUser, chosenRole) {
  const fields = signUpProfileFields(chosenRole)
  await setDoc(doc(getFirestore(), 'users', firebaseUser.uid), {
    email: firebaseUser.email,
    ...fields,
    createdAt: serverTimestamp(),
  })
  role.value = fields.role
  clubRequest.value = fields.clubRequest ?? ''
  hasProfile.value = true
}

export function initAuth() {
  const auth = getAuth()
  onAuthStateChanged(auth, async (firebaseUser) => {
    user.value = firebaseUser
    emailVerified.value = !!firebaseUser?.emailVerified
    await syncProfileState(firebaseUser)
    resolveAuthReady()
  })
}

export async function logout() {
  await signOut(getAuth())
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(getAuth(), email)
}

// Google accounts arrive with a verified email. A first-time Google user has no
// users/{uid} document, so the router guard sends them to /complete-profile.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const { user: firebaseUser } = await signInWithPopup(getAuth(), provider)
  user.value = firebaseUser
  emailVerified.value = firebaseUser.emailVerified
  await syncProfileState(firebaseUser)
  return firebaseUser
}

export async function sendVerification() {
  await sendEmailVerification(getAuth().currentUser)
}

export async function refreshVerification() {
  const current = getAuth().currentUser
  if (!current) {
    return false
  }
  await current.reload()
  if (current.emailVerified) {
    // The ID token still says email_verified: false until it is re-issued, and
    // the API trusts only the token.
    await current.getIdToken(true)
  }
  emailVerified.value = current.emailVerified
  return current.emailVerified
}

export function redirectTarget(query) {
  const redirect = query.redirect
  // Only same-app paths, so ?redirect= can't bounce users to another site.
  return typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
    ? redirect
    : '/'
}

export function useAuth() {
  return {
    user,
    role,
    clubRequest,
    hasProfile,
    emailVerified,
    isAuthenticated: computed(() => !!user.value),
    isClubMember: computed(() => role.value === ROLES.CLUB_MEMBER),
    isParticipant: computed(() => role.value === ROLES.PARTICIPANT),
    isAdmin: computed(() => role.value === ROLES.ADMIN),
    roleLabel: computed(() => ROLE_LABELS[role.value] || ''),
    logout,
  }
}
