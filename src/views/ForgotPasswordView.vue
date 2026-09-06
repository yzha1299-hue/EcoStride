<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <h1 class="h3 fw-bold mb-3">Reset your password</h1>
      <p class="text-muted mb-4">Enter your account email and we'll send you a link to reset your password.</p>

      <p>
        <input v-model.trim="email" class="form-control" type="email" placeholder="Email" autocomplete="email" />
      </p>
      <p>
        <button class="btn btn-success" type="button" :disabled="isSubmitting" @click="submit">
          {{ isSubmitting ? 'Sending…' : 'Send reset email' }}
        </button>
      </p>
      <p v-if="errorMessage" class="text-danger small mb-0">{{ errorMessage }}</p>
      <p v-if="successMessage" class="text-success small mb-0">{{ successMessage }}</p>
      <p class="small mt-3 mb-0">
        <RouterLink to="/FireLogin">Back to sign in</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { resetPassword } from '../auth/authState'

const email = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const isSubmitting = ref(false)

const submit = () => {
  errorMessage.value = ''
  successMessage.value = ''

  if (!email.value) {
    errorMessage.value = 'Please enter your email.'
    return
  }

  isSubmitting.value = true
  resetPassword(email.value)
    .then(() => {
      successMessage.value = 'If an account exists for that email, a reset link is on its way.'
    })
    .catch((error) => {
      errorMessage.value = error.message
    })
    .finally(() => {
      isSubmitting.value = false
    })
}
</script>
