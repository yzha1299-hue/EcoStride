<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <template v-if="checking">
        <p class="text-muted mb-0">Checking your account...</p>
      </template>

      <template v-else-if="hasProfile">
        <h1 class="h3 fw-bold mb-3">Profile already set up</h1>
        <p class="text-muted mb-4">
          Your account already has a role assigned. Roles can't be changed here once set.
        </p>
        <RouterLink class="btn btn-success" to="/">Back to home</RouterLink>
      </template>

      <template v-else>
        <h1 class="h3 fw-bold mb-3">Choose your role</h1>
        <p class="text-muted mb-4">
          Your account doesn't have a role assigned yet. Pick one to finish setting up your profile.
        </p>

        <p>
          <label class="form-label" for="profile-role">Role</label>
          <select id="profile-role" v-model="selectedRole" class="form-select">
            <option :value="ROLES.PARTICIPANT">Participant</option>
            <option :value="ROLES.CLUB_MEMBER">Club member</option>
          </select>
        </p>
        <p>
          <button class="btn btn-success" type="button" :disabled="isSubmitting" @click="submit">
            {{ isSubmitting ? 'Saving…' : 'Save role' }}
          </button>
        </p>
        <p class="text-danger small mb-0" role="alert">{{ errorMessage }}</p>
      </template>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { useRoute, useRouter } from 'vue-router'
import { createUserProfile, redirectTarget, ROLES, setRole, user } from '../auth/authState'
import { authErrorMessage } from '../auth/authErrors'

const router = useRouter()
const route = useRoute()
const selectedRole = ref(ROLES.PARTICIPANT)
const errorMessage = ref('')
const isSubmitting = ref(false)
const checking = ref(true)
const hasProfile = ref(false)

onMounted(async () => {
  const snapshot = await getDoc(doc(getFirestore(), 'users', user.value.uid))
  hasProfile.value = snapshot.exists()
  checking.value = false
})

function submit() {
  errorMessage.value = ''
  isSubmitting.value = true
  createUserProfile(user.value, selectedRole.value)
    .then(() => {
      setRole(selectedRole.value)
      router.push(redirectTarget(route.query))
    })
    .catch((error) => {
      errorMessage.value = authErrorMessage(error)
    })
    .finally(() => {
      isSubmitting.value = false
    })
}
</script>
