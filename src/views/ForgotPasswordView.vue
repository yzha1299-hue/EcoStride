<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <h1 class="h3 fw-bold mb-3">Reset your password</h1>
      <p class="text-muted mb-4">Enter your account email and we'll send you a link to reset your password.</p>

      <form novalidate @submit.prevent="submit">
        <div class="mb-3">
          <label class="form-label" for="reset-email">Email</label>
          <input id="reset-email" v-model.trim="email" class="form-control" type="email" autocomplete="email" />
        </div>
        <button class="btn btn-success mb-3" type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Sending…' : 'Send reset email' }}
        </button>
      </form>
      <p class="text-danger small mb-0" role="alert">{{ errorMessage }}</p>
      <p class="text-success small mb-0" role="status">{{ successMessage }}</p>
      <p class="small mt-3 mb-0">
        <RouterLink to="/FireLogin">Back to sign in</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { resetPassword } from '../auth/authState'
import { authErrorMessage } from '../auth/authErrors'
import { validateEmail } from '../utils/validation'
const email = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isSubmitting = ref(false)

const submit = () => {
  errorMessage.value = ''
  successMessage.value = ''

  const emailError = validateEmail(email.value)
  if (emailError) {
    errorMessage.value = emailError
    return
  }

  isSubmitting.value = true
  resetPassword(email.value)
    .then(() => {
      successMessage.value = 'If an account exists for that email, a reset link is on its way.'
    })
    .catch((error) => {
      errorMessage.value = authErrorMessage(error)
    })
    .finally(() => {
      isSubmitting.value = false
    })
}
</script>
