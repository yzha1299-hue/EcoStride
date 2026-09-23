<script setup>
import { computed, ref } from 'vue'
import { emailVerified, refreshVerification, sendVerification, user } from '../auth/authState'
import { authErrorMessage } from '../auth/authErrors'

const status = ref('')
const isBusy = ref(false)

const visible = computed(() => !!user.value && !emailVerified.value)

async function resend() {
  isBusy.value = true
  try {
    await sendVerification()
    status.value = `Verification email sent to ${user.value.email}.`
  } catch (error) {
    status.value = authErrorMessage(error)
  } finally {
    isBusy.value = false
  }
}

async function recheck() {
  isBusy.value = true
  try {
    const verified = await refreshVerification()
    status.value = verified ? '' : "We still can't see a confirmation. Open the link in the email, then try again."
  } catch (error) {
    status.value = authErrorMessage(error)
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="alert alert-warning rounded-0 border-0 border-bottom mb-0 py-2">
    <div class="container d-flex flex-wrap align-items-center gap-2 small">
      <span class="me-auto">
        Please verify your email address. You can use EcoStride now, but email features stay locked until you do.
      </span>
      <button class="btn btn-sm btn-outline-dark" type="button" :disabled="isBusy" @click="resend">
        Resend verification email
      </button>
      <button class="btn btn-sm btn-dark" type="button" :disabled="isBusy" @click="recheck">
        I've verified
      </button>
      <p class="w-100 mb-0" role="status">{{ status }}</p>
    </div>
  </div>
</template>
