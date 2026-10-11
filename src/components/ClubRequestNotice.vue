<script setup>
import { computed, ref } from 'vue'
import { clubRequest, role, ROLES, user } from '../auth/authState'

// Tells a participant where their request to become a club member stands. A
// pending request stays visible until an admin decides; a declined one can be
// dismissed (remembered in this browser, per account).
const dismissedKey = computed(() => `ecostride.clubRequestDismissed.${user.value?.uid}`)
// The account the notice was dismissed for in this page session.
const dismissedFor = ref(null)

function readDismissed() {
  try {
    return localStorage.getItem(dismissedKey.value) === 'declined'
  } catch {
    return false
  }
}

const state = computed(() => {
  if (!user.value || role.value !== ROLES.PARTICIPANT) return ''
  if (clubRequest.value === 'declined') return dismissedFor.value === user.value.uid || readDismissed() ? '' : 'declined'
  return clubRequest.value === 'pending' ? 'pending' : ''
})

function dismiss() {
  dismissedFor.value = user.value.uid
  try {
    localStorage.setItem(dismissedKey.value, 'declined')
  } catch {
    // Not remembered; it just shows again next visit.
  }
}
</script>

<template>
  <div
    v-if="state"
    class="alert rounded-0 border-0 border-bottom mb-0 py-2"
    :class="state === 'pending' ? 'alert-info' : 'alert-secondary'"
  >
    <div class="container d-flex flex-wrap align-items-center gap-2 small">
      <p v-if="state === 'pending'" class="me-auto mb-0" role="status">
        <strong>You're registered as a participant.</strong> Your request to become a club member has been submitted
        and is waiting for admin approval. You'll be able to create and manage events once it's approved.
      </p>
      <p v-else class="me-auto mb-0" role="status">
        <strong>Your club member request wasn't approved.</strong> You can keep using EcoStride as a participant.
      </p>
      <button v-if="state === 'declined'" class="btn btn-sm btn-outline-dark" type="button" @click="dismiss">
        Dismiss
      </button>
    </div>
  </div>
</template>
