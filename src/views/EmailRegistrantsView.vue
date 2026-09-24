<script setup>
import { nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { emailVerified, user } from '../auth/authState'
import { emailRegistrants } from '../api/client'
import { toEvent } from '../composables/useEvents'
import { formatLongDate, formatTimeRange } from '../utils/format'
import VerifyEmailPrompt from '../components/VerifyEmailPrompt.vue'

// Compose a message to everyone registered for one of your events. The server
// looks up the recipients and sends each one an individual copy with a
// calendar invite; this page only supplies the text and an optional flyer.
// Opened with ?cancelled=1 right after cancelling, it starts with a notice.
const SUBJECT_MAX = 150
const MESSAGE_MAX = 5000
const MAX_FILE_BYTES = 2 * 1024 * 1024
const FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
}

const route = useRoute()
const eventId = route.params.id
const isCancellationNotice = route.query.cancelled === '1'

const event = ref(null)
const loading = ref(true)
const loadError = ref('')

const form = reactive({ subject: '', message: '' })
const file = ref(null)
const fileInput = ref(null)
const errors = ref({})
const status = ref('')
const statusIsError = ref(false)
const sending = ref(false)
const formEl = ref(null)

onMounted(async () => {
  try {
    const snapshot = await getDoc(doc(getFirestore(), 'events', eventId))
    if (!snapshot.exists() || snapshot.data().createdBy !== user.value?.uid) {
      loadError.value = "This event doesn't exist or you can't email its registrants."
      return
    }
    event.value = toEvent(snapshot)
    if (isCancellationNotice) {
      const e = event.value
      form.subject = `Cancelled: ${e.title}`
      form.message =
        `Hi,\n\nUnfortunately "${e.title}" on ${formatLongDate(e.startsAt)} ` +
        `(${formatTimeRange(e.startsAt, e.endsAt)}, ${e.venue}) has been cancelled.\n\n` +
        `Sorry for any inconvenience, and thank you for registering.` +
        (e.clubName ? `\n\n${e.clubName}` : '')
    }
  } catch {
    loadError.value = 'Unable to load this event right now. Please try again.'
  } finally {
    loading.value = false
  }
})

function fileError(chosen) {
  const extensions = FILE_TYPES[chosen.type]
  const name = chosen.name.toLowerCase()
  if (!extensions || !extensions.some((extension) => name.endsWith(extension))) {
    return 'Choose a PDF, PNG or JPG file.'
  }
  if (chosen.size > MAX_FILE_BYTES) {
    return `That file is ${(chosen.size / 1024 / 1024).toFixed(1)} MB. Attachments must be 2 MB or smaller.`
  }
  return ''
}

// Checked as soon as a file is picked, so a bad one is flagged before sending.
function onFileChange(domEvent) {
  const chosen = domEvent.target.files[0] ?? null
  const problem = chosen ? fileError(chosen) : ''
  errors.value = { ...errors.value, attachment: problem || undefined }
  file.value = problem ? null : chosen
}

function clearFile() {
  file.value = null
  fileInput.value.value = ''
  errors.value = { ...errors.value, attachment: undefined }
}

function readAsBase64(chosen) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(chosen)
  })
}

function validate() {
  const found = {}
  const subject = form.subject.trim()
  const message = form.message.trim()
  if (!subject) found.subject = 'Enter a subject.'
  else if (subject.length > SUBJECT_MAX) found.subject = `Keep the subject to ${SUBJECT_MAX} characters or fewer.`
  if (!message) found.message = 'Write a message.'
  else if (message.length > MESSAGE_MAX) found.message = `Keep the message to ${MESSAGE_MAX} characters or fewer.`
  if (errors.value.attachment) found.attachment = errors.value.attachment
  return found
}

function fieldAttrs(field, hintId) {
  const describedBy = [errors.value[field] ? `${field}-error` : null, hintId].filter(Boolean).join(' ')
  return {
    'aria-invalid': errors.value[field] ? 'true' : undefined,
    'aria-describedby': describedBy || undefined,
  }
}

async function send() {
  status.value = ''
  errors.value = validate()
  if (Object.keys(errors.value).some((key) => errors.value[key])) {
    statusIsError.value = true
    status.value = 'Please fix the highlighted fields.'
    await nextTick()
    formEl.value.querySelector('[aria-invalid="true"]')?.focus()
    return
  }

  sending.value = true
  try {
    const attachment = file.value
      ? { name: file.value.name, type: file.value.type, base64: await readAsBase64(file.value) }
      : undefined
    const { sent, remainingToday } = await emailRegistrants(eventId, {
      subject: form.subject.trim(),
      message: form.message.trim(),
      attachment,
    })
    statusIsError.value = false
    status.value =
      `Sent to ${sent} registrant${sent === 1 ? '' : 's'}, each as an individual email. ` +
      `You can send ${remainingToday} more about this event today.`
  } catch (error) {
    statusIsError.value = true
    if (error.code === 'ATTACHMENT_INVALID') {
      errors.value = { attachment: error.message }
    }
    status.value = error.message
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 48rem">
    <RouterLink class="small" :to="{ name: 'events-manage' }">&larr; Back to manage events</RouterLink>

    <p v-if="loading" class="text-muted mt-3">Loading event...</p>
    <p v-else-if="loadError" class="alert alert-warning mt-3" role="alert">{{ loadError }}</p>

    <template v-else>
      <h1 class="h2 fw-bold mt-2 mb-1">Email registrants</h1>
      <p class="text-muted mb-4">
        {{ event.title }} · {{ formatLongDate(event.startsAt) }}, {{ formatTimeRange(event.startsAt, event.endsAt) }}
      </p>

      <div v-if="isCancellationNotice" class="alert alert-info">
        "{{ event.title }}" is now cancelled. Let the {{ event.registeredCount }} registered
        {{ event.registeredCount === 1 ? 'person' : 'people' }} know - we've started a message for you. Or
        <RouterLink :to="{ name: 'events-manage' }">skip this</RouterLink>.
      </div>

      <p v-if="!event.registeredCount" class="text-muted">Nobody has registered for this event, so there is no one to email.</p>

      <VerifyEmailPrompt v-else-if="!emailVerified" class="border rounded-3 p-3" />

      <form v-else ref="formEl" novalidate @submit.prevent="send">
        <p class="small text-muted">
          Each of the {{ event.registeredCount }} registrants gets their own copy, so nobody sees anyone else's address.
          A calendar invite (.ics) for the event is always attached, and replies come to you. You can send up to 5
          emails per event per day.
        </p>

        <div class="mb-3">
          <label class="form-label" for="subject">Subject</label>
          <input
            id="subject"
            v-model="form.subject"
            class="form-control"
            :class="{ 'is-invalid': errors.subject }"
            v-bind="fieldAttrs('subject')"
            :maxlength="SUBJECT_MAX"
          />
          <div v-if="errors.subject" id="subject-error" class="invalid-feedback">{{ errors.subject }}</div>
        </div>

        <div class="mb-3">
          <label class="form-label" for="message">Message</label>
          <textarea
            id="message"
            v-model="form.message"
            class="form-control"
            :class="{ 'is-invalid': errors.message }"
            v-bind="fieldAttrs('message')"
            rows="8"
            :maxlength="MESSAGE_MAX"
          ></textarea>
          <div v-if="errors.message" id="message-error" class="invalid-feedback">{{ errors.message }}</div>
        </div>

        <div class="mb-4">
          <label class="form-label" for="attachment">Attachment <span class="text-muted">(optional)</span></label>
          <input
            id="attachment"
            ref="fileInput"
            type="file"
            class="form-control"
            :class="{ 'is-invalid': errors.attachment }"
            v-bind="fieldAttrs('attachment', 'attachment-hint')"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            @change="onFileChange"
          />
          <div v-if="errors.attachment" id="attachment-error" class="invalid-feedback">{{ errors.attachment }}</div>
          <div id="attachment-hint" class="form-text">A flyer or map: PDF, PNG or JPG, up to 2 MB.</div>
          <button v-if="file" class="btn btn-link btn-sm px-0" type="button" @click="clearFile">
            Remove {{ file.name }}
          </button>
        </div>

        <p class="small" :class="statusIsError ? 'text-danger' : 'text-success'" role="status">{{ status }}</p>

        <button class="btn btn-success" type="submit" :disabled="sending">
          {{ sending ? 'Sending...' : `Send to ${event.registeredCount} registrant${event.registeredCount === 1 ? '' : 's'}` }}
        </button>
      </form>
    </template>
  </div>
</template>
