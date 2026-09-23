<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <h1 class="h3 fw-bold mb-3">Sign in</h1>
      <p>
        <input v-model.trim="email" class="form-control" type="email" placeholder="Email" autocomplete="email" />
      </p>
      <p>
        <input
          v-model="password"
          class="form-control"
          type="password"
          placeholder="Password"
          autocomplete="current-password"
        />
      </p>
      <p>
        <button class="btn btn-success" type="button" :disabled="isSubmitting" @click="signin">
          {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
        </button>
      </p>
      <p class="text-danger small mb-0" role="alert">{{ errorMessage }}</p>
      <div class="d-flex align-items-center gap-2 my-3 text-muted small">
        <hr class="flex-grow-1 m-0" />
        <span>or</span>
        <hr class="flex-grow-1 m-0" />
      </div>
      <GoogleSignInButton @error="errorMessage = $event" />
      <p class="small mt-3 mb-0">
        <RouterLink to="/forgot-password">Forgot password?</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { useRoute, useRouter } from 'vue-router'
import { redirectTarget, syncProfileState } from '../auth/authState'
import { authErrorMessage } from '../auth/authErrors'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import { validateEmail } from '../utils/validation'

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)
const router = useRouter()
const route = useRoute()
const auth = getAuth()

const signin = () => {
  errorMessage.value = ''

  const emailError = validateEmail(email.value)
  if (emailError) {
    errorMessage.value = emailError
    return
  }
  if (!password.value) {
    errorMessage.value = 'Please enter your password.'
    return
  }

  isSubmitting.value = true
  signInWithEmailAndPassword(auth, email.value, password.value)
    .then(async (data) => {
      await syncProfileState(data.user)
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
