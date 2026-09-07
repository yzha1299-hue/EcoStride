<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <h1 class="h3 fw-bold mb-3">Create an Account</h1>
      <p class="text-muted mb-4">Choose a role. This controls which pages you can open after sign in.</p>

      <p>
        <input v-model.trim="email" class="form-control" type="email" placeholder="Email" autocomplete="email" />
      </p>
      <p>
        <input
          v-model="password"
          class="form-control"
          type="password"
          placeholder="Password (min. 6 characters)"
          autocomplete="new-password"
        />
      </p>
      <p>
        <input
          v-model="confirmPassword"
          class="form-control"
          type="password"
          placeholder="Confirm password"
          autocomplete="new-password"
        />
      </p>
      <p>
        <select v-model="selectedRole" class="form-select">
          <option :value="ROLES.PARTICIPANT">Participant</option>
          <option :value="ROLES.CLUB_MEMBER">Club member</option>
        </select>
      </p>
      <p>
        <button class="btn btn-success" type="button" :disabled="isSubmitting" @click="register">
          {{ isSubmitting ? 'Creating account…' : 'Create account' }}
        </button>
      </p>
      <p v-if="errorMessage" class="text-danger small mb-0">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { useRouter } from 'vue-router'
import { createUserProfile, ROLES, setRole } from '../auth/authState'
import { validateEmail } from '../utils/validation'

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const selectedRole = ref(ROLES.PARTICIPANT)
const errorMessage = ref('')
const isSubmitting = ref(false)
const router = useRouter()
const auth = getAuth()

function validate() {
  const emailError = validateEmail(email.value)
  if (emailError) {
    return emailError
  }
  if (!password.value) {
    return 'Please enter a password.'
  }
  if (password.value.length < 6) {
    return 'Password must be at least 6 characters.'
  }
  if (password.value !== confirmPassword.value) {
    return 'Passwords do not match.'
  }
  return ''
}

const register = () => {
  errorMessage.value = ''

  const validationError = validate()
  if (validationError) {
    errorMessage.value = validationError
    return
  }

  isSubmitting.value = true
  createUserWithEmailAndPassword(auth, email.value, password.value)
    .then((data) => createUserProfile(data.user, selectedRole.value))
    .then(() => {
      setRole(selectedRole.value)
      router.push('/')
    })
    .catch((error) => {
      errorMessage.value = error.message
    })
    .finally(() => {
      isSubmitting.value = false
    })
}
</script>
