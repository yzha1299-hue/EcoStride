<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <h1 class="h3 fw-bold mb-3">Create an Account</h1>
      <p class="text-muted mb-4">Choose a role. This controls which pages you can open after sign in.</p>

      <form novalidate @submit.prevent="register">
        <div class="mb-3">
          <label class="form-label" for="register-email">Email</label>
          <input id="register-email" v-model.trim="email" class="form-control" type="email" autocomplete="email" />
        </div>
        <div class="mb-3">
          <label class="form-label" for="register-password">Password</label>
          <input
            id="register-password"
            v-model="password"
            class="form-control"
            type="password"
            autocomplete="new-password"
            aria-describedby="register-password-hint"
          />
          <div id="register-password-hint" class="form-text">At least 6 characters.</div>
        </div>
        <div class="mb-3">
          <label class="form-label" for="register-confirm">Confirm password</label>
          <input
            id="register-confirm"
            v-model="confirmPassword"
            class="form-control"
            type="password"
            autocomplete="new-password"
          />
        </div>
        <div class="mb-3">
          <label class="form-label" for="register-role">Role</label>
          <select id="register-role" v-model="selectedRole" class="form-select">
            <option :value="ROLES.PARTICIPANT">Participant</option>
            <option :value="ROLES.CLUB_MEMBER">Club member</option>
          </select>
        </div>
        <button class="btn btn-success mb-3" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
      <p class="text-danger small mb-0" role="alert">{{ errorMessage }}</p>
      <div class="d-flex align-items-center gap-2 my-3 text-muted small">
        <hr class="flex-grow-1 m-0" />
        <span>or</span>
        <hr class="flex-grow-1 m-0" />
      </div>
      <GoogleSignInButton @error="errorMessage = $event" />
      <p class="small text-muted mt-2 mb-0">You'll choose your role after signing in with Google.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { useRouter } from 'vue-router'
import { createUserProfile, ROLES, sendVerification, setRole } from '../auth/authState'
import { authErrorMessage } from '../auth/authErrors'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
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
      // Non-blocking: the account works without verification; only the
      // email-sending features require it, and the banner offers a resend.
      sendVerification().catch(() => {})
      router.push('/')
    })
    .catch((error) => {
      errorMessage.value = authErrorMessage(error)
    })
    .finally(() => {
      isSubmitting.value = false
    })
}
</script>
