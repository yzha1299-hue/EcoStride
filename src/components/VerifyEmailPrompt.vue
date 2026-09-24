<script setup>
import { ref } from 'vue'
import { sendVerification, user } from '../auth/authState'
import { authErrorMessage } from '../auth/authErrors'

// Shown in place of an email action while the user's address is unverified.
const status = ref('')
const busy = ref(false)

async function resend() {
  busy.value = true
  try {
    await sendVerification()
    status.value = `Verification email sent to ${user.value.email}. Open the link, then choose "I've verified" in the banner at the top.`
  } catch (error) {
    status.value = authErrorMessage(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <p class="small mb-2">
      Email features are locked until you verify your email address, so messages and registrant details only go
      out from an address you've proved is yours.
    </p>
    <button class="btn btn-outline-secondary btn-sm" type="button" :disabled="busy" @click="resend">
      Resend verification email
    </button>
    <p class="small mt-2 mb-0" role="status">{{ status }}</p>
  </div>
</template>
