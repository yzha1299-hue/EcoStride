import { computed, ref } from 'vue'
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth'

export const ROLES = {
  PARTICIPANT: 'participant',
  CLUB_MEMBER: 'clubMember',
}

export const ROLE_LABELS = {
  [ROLES.PARTICIPANT]: 'Participant',
  [ROLES.CLUB_MEMBER]: 'Club member',
}

const STORAGE_KEY = 'ecostride-roles'

export const user = ref(null)
export const role = ref('')

let resolveAuthReady
export const authReady = new Promise((resolve) => {
  resolveAuthReady = resolve
})

function readStoredRoles() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function persistRole(uid, nextRole) {
  const stored = readStoredRoles()
  stored[uid] = nextRole
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  role.value = nextRole
}

export function resolveRole(firebaseUser) {
  if (!firebaseUser) {
    return ''
  }

  const fromProfile = firebaseUser.displayName
  if (fromProfile === 'clubAdmin') {
    return ROLES.CLUB_MEMBER
  }
  if (fromProfile === ROLES.PARTICIPANT || fromProfile === ROLES.CLUB_MEMBER) {
    return fromProfile
  }

  const storedRole = readStoredRoles()[firebaseUser.uid]
  if (storedRole === 'clubAdmin') {
    return ROLES.CLUB_MEMBER
  }
  return storedRole || ROLES.PARTICIPANT
}

export function initAuth() {
  const auth = getAuth()
  onAuthStateChanged(auth, (firebaseUser) => {
    user.value = firebaseUser
    role.value = resolveRole(firebaseUser)
    resolveAuthReady()
  })
}

export async function logout() {
  await signOut(getAuth())
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
