<script setup>
import { nextTick, reactive, ref, watch } from 'vue'
import { registerForEvent } from '../api/client'
import { user } from '../auth/authState'
import { formatLongDate, formatTimeRange } from '../utils/format'

// Modal registration form, built on the native <dialog>: showModal() makes the
// rest of the page inert, moves focus in and closes on Escape. On top of that,
// Tab is wrapped so focus stays inside, and focus goes back to the button that
// opened it when it closes.
const props = defineProps({
  // The event to register for; null keeps the dialog closed.
  event: { type: Object, default: null },
})
const emit = defineEmits(['close', 'registered', 'full'])

const NAME_MAX = 100
const NEEDS_MAX = 500

const dialogEl = ref(null)
const nameInput = ref(null)
const closeButton = ref(null)
const form = reactive({ name: '', needs: '' })
const errors = ref({})
const status = ref('')
const submitting = ref(false)
const isFull = ref(false)
let returnFocusTo = null

watch(
  () => props.event,
  async (event) => {
    if (!event) {
      if (dialogEl.value?.open) dialogEl.value.close()
      return
    }
    returnFocusTo = document.activeElement
    Object.assign(form, { name: user.value?.displayName ?? '', needs: '' })
    errors.value = {}
    status.value = ''
    isFull.value = false
    await nextTick()
    dialogEl.value.showModal()
    nameInput.value.focus()
  },
)

// Fires for Escape, the Close button and close() alike. After a successful
// registration the Register button is gone, so the page moves focus instead.
function onClose() {
  emit('close')
  if (returnFocusTo?.isConnected) returnFocusTo.focus()
  returnFocusTo = null
}

function onCancel(domEvent) {
  // Don't let Escape abandon a request that may already have taken a place.
  if (submitting.value) domEvent.preventDefault()
}

function trapTab(domEvent) {
  if (domEvent.key !== 'Tab') return
  const focusable = [...dialogEl.value.querySelectorAll('input, textarea, button')].filter(
    (element) => !element.disabled,
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (domEvent.shiftKey && document.activeElement === first) {
    domEvent.preventDefault()
    last.focus()
  } else if (!domEvent.shiftKey && document.activeElement === last) {
    domEvent.preventDefault()
    first.focus()
  }
}

function validate() {
  const found = {}
  const name = form.name.trim()
  if (!name) found.name = 'Enter your name.'
  else if (name.length > NAME_MAX) found.name = `Name must be at most ${NAME_MAX} characters.`
  if (form.needs.trim().length > NEEDS_MAX) found.needs = `Keep this to ${NEEDS_MAX} characters or fewer.`
  return found
}

function fieldAttrs(field) {
  return {
    'aria-invalid': errors.value[field] ? 'true' : undefined,
    'aria-describedby': errors.value[field] ? `reg-${field}-error` : undefined,
  }
}

async function submit() {
  if (submitting.value || isFull.value) return
  status.value = ''
  errors.value = validate()
  if (Object.keys(errors.value).length) {
    status.value = 'Please fix the highlighted fields.'
    await nextTick()
    dialogEl.value.querySelector('[aria-invalid="true"]')?.focus()
    return
  }

  submitting.value = true
  try {
    const result = await registerForEvent(props.event.id, {
      name: form.name.trim(),
      needs: form.needs.trim(),
    })
    emit('registered', result)
  } catch (error) {
    if (error.code === 'EVENT_FULL') {
      isFull.value = true
      status.value = 'Sorry, this event is now full - the last place was taken while you were filling in the form.'
      emit('full')
    } else if (error.code === 'ALREADY_REGISTERED') {
      emit('registered', {})
    } else {
      status.value = error.message
    }
  } finally {
    submitting.value = false
  }
  if (isFull.value) {
    // The focused Register button has just gone; keep focus in the dialog.
    await nextTick()
    closeButton.value.focus()
  }
}
</script>

<template>
  <dialog
    ref="dialogEl"
    class="registration-dialog border-0 rounded-3 shadow p-0"
    aria-labelledby="reg-title"
    aria-describedby="reg-when"
    @close="onClose"
    @cancel="onCancel"
    @keydown="trapTab"
  >
    <form v-if="event" class="p-4" novalidate @submit.prevent="submit">
      <h2 id="reg-title" class="h5 fw-bold mb-1">Register for {{ event.title }}</h2>
      <p id="reg-when" class="small text-muted mb-3">
        {{ formatLongDate(event.startsAt) }}, {{ formatTimeRange(event.startsAt, event.endsAt) }} · {{ event.venue }}
      </p>

      <div class="mb-3">
        <label class="form-label" for="reg-name">Your name</label>
        <input
          id="reg-name"
          ref="nameInput"
          v-model="form.name"
          class="form-control"
          :class="{ 'is-invalid': errors.name }"
          v-bind="fieldAttrs('name')"
          :maxlength="NAME_MAX"
          autocomplete="name"
          :disabled="isFull"
        />
        <div v-if="errors.name" id="reg-name-error" class="invalid-feedback">{{ errors.name }}</div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="reg-needs">
          Accessibility or dietary needs <span class="text-muted">(optional)</span>
        </label>
        <textarea
          id="reg-needs"
          v-model="form.needs"
          class="form-control"
          :class="{ 'is-invalid': errors.needs }"
          v-bind="fieldAttrs('needs')"
          rows="3"
          :maxlength="NEEDS_MAX"
          :disabled="isFull"
        ></textarea>
        <div v-if="errors.needs" id="reg-needs-error" class="invalid-feedback">{{ errors.needs }}</div>
        <div v-else class="form-text">Only the organiser can see this.</div>
      </div>

      <p class="small mb-3" :class="isFull ? 'text-danger fw-semibold' : 'text-danger'" role="alert">{{ status }}</p>

      <div class="d-flex gap-2 justify-content-end">
        <button ref="closeButton" class="btn btn-outline-secondary" type="button" :disabled="submitting" @click="dialogEl.close()">
          {{ isFull ? 'Close' : 'Cancel' }}
        </button>
        <button v-if="!isFull" class="btn btn-success" type="submit" :disabled="submitting">
          {{ submitting ? 'Registering...' : 'Register' }}
        </button>
      </div>
    </form>
  </dialog>
</template>

<style scoped>
.registration-dialog {
  width: min(32rem, calc(100vw - 2rem));
}

.registration-dialog::backdrop {
  background: rgb(0 0 0 / 0.5);
}
</style>
