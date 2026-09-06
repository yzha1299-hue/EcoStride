import { computed, ref } from 'vue'
import { getAuth, onAuthStateChanged, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'

export const ROLES = {
  PARTICIPANT: 'participant',
  CLUB_MEMBER: 'clubMember',
}

export const ROLE_LABELS = {
  [ROLES.PARTICIPANT]: 'Participant',
  [ROLES.CLUB_MEMBER]: 'Club member',
}

export const user = ref(null)
export const role = ref('')

let resolveAuthReady
export const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve
})

// The user's role lives in Firestore (users/{uid}), not on the client. Firestore
// security rules let a user create that document once, for themselves, with a
// valid role value, and forbid any update/delete afterwards - so a signed-in
// client cannot escalate its own privileges by editing local state.
export async function resolveRole(firebaseUser) {
  if (!firebaseUser) {
    return ''
  }

  const snapshot = await getDoc(doc(getFirestore(), 'users', firebaseUser.uid))
  const storedRole = snapshot.data()?.role

  if (storedRole === ROLES.PARTICIPANT || storedRole === ROLES.CLUB_MEMBER) {
    return storedRole
  }
  return ROLES.PARTICIPANT
}

export async function createUserProfile(firebaseUser, selectedRole) {
  await setDoc(doc(getFirestore(), 'users', firebaseUser.uid), {
    email: firebaseUser.email,
    role: selectedRole,
    createdAt: serverTimestamp(),
  })
}

export function setRole(nextRole) {
  role.value = nextRole
}

export function initAuth() {
  const auth = getAuth()
  onAuthStateChanged(auth, async (firebaseUser) => {
    user.value = firebaseUser
    role.value = await resolveRole(firebaseUser)
    resolveAuthReady()
  })
}

export async function logout() {
  await signOut(getAuth())
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(getAuth(), email)
}

export function useAuth() {
  return {
    user,
    role,
    isAuthenticated: computed(() => !!user.value),
    isClubMember: computed(() => role.value === ROLES.CLUB_MEMBER),
    isParticipant: computed(() => role.value === ROLES.PARTICIPANT),
    roleLabel: computed(() => ROLE_LABELS[role.value] || ''),
    logout,
  }
}
