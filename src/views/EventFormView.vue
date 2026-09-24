<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { user } from '../auth/authState'
import { toEvent } from '../composables/useEvents'
import { toMelbourneInputs } from '../utils/format'
import {
  ACCESS_OPTIONS,
  EVENT_TYPES,
  emptyEventForm,
  eventFieldsFromForm,
  validateEventForm,
} from '../utils/eventForm'

const route = useRoute()
const router = useRouter()
const db = getFirestore()

const eventId = computed(() => route.params.id)
const isEdit = computed(() => Boolean(eventId.value))

const form = reactive(emptyEventForm())
const errors = ref({})
const existing = ref(null)
const loading = ref(false)
const loadError = ref('')
const saving = ref(false)
const status = ref('')
const formEl = ref(null)

const registeredCount = computed(() => existing.value?.registeredCount ?? 0)
const isCancelled = computed(() => existing.value?.status === 'cancelled')

onMounted(async () => {
  if (!isEdit.value) {
    return
  }
  loading.value = true
  try {
    const snapshot = await getDoc(doc(db, 'events', eventId.value))
    if (!snapshot.exists() || snapshot.data().createdBy !== user.value?.uid) {
      loadError.value = "This event doesn't exist or you can't edit it."
      return
    }
    const event = toEvent(snapshot)
    existing.value = event
    const start = toMelbourneInputs(event.startsAt)
    Object.assign(form, {
      title: event.title,
      type: event.type,
      description: event.description ?? '',
      venue: event.venue,
      address: event.address,
      date: start.date,
      startTime: start.time,
      endTime: toMelbourneInputs(event.endsAt).time,
      capacity: String(event.capacity),
      access: [...(event.access ?? [])],
      clubName: event.clubName ?? '',
    })
  } catch {
    loadError.value = 'Unable to load this event right now. Please try again.'
  } finally {
    loading.value = false
  }
})

function fieldAttrs(field) {
  return {
    'aria-invalid': errors.value[field] ? 'true' : undefined,
    'aria-describedby': errors.value[field] ? `${field}-error` : undefined,
  }
}

async function focusFirstError() {
  await nextTick()
  formEl.value?.querySelector('[aria-invalid="true"]')?.focus()
}

async function save() {
  status.value = ''
  errors.value = validateEventForm(form, { minCapacity: registeredCount.value })
  if (Object.keys(errors.value).length) {
    status.value = 'Please fix the highlighted fields.'
    focusFirstError()
    return
  }

  const fields = eventFieldsFromForm(form)
  const stored = {
    ...fields,
    startsAt: Timestamp.fromDate(fields.startsAt),
    endsAt: Timestamp.fromDate(fields.endsAt),
  }

  saving.value = true
  try {
    if (isEdit.value) {
      await updateDoc(doc(db, 'events', eventId.value), stored)
    } else {
      await addDoc(collection(db, 'events'), {
        ...stored,
        registeredCount: 0,
        status: 'open',
        createdBy: user.value.uid,
        createdAt: serverTimestamp(),
      })
    }
    router.push({ name: 'events-manage', query: { saved: form.title.trim() } })
  } catch {
    status.value = "Couldn't save the event. Check the details and try again."
  } finally {
    saving.value = false
  }
}

async function cancelEvent() {
  const message = registeredCount.value
    ? `Cancel "${existing.value.title}"? ${registeredCount.value} registered people will see it as cancelled. This can't be undone.`
    : `Cancel "${existing.value.title}"? This can't be undone.`
  if (!window.confirm(message)) {
    return
  }
  saving.value = true
  try {
    await updateDoc(doc(db, 'events', eventId.value), { status: 'cancelled' })
    // With people registered, go straight to a pre-filled notice for them.
    router.push(
      registeredCount.value
        ? { name: 'event-email', params: { id: eventId.value }, query: { cancelled: '1' } }
        : { name: 'events-manage', query: { cancelled: existing.value.title } },
    )
  } catch {
    status.value = "Couldn't cancel the event. Please try again."
  } finally {
    saving.value = false
  }
}

async function deleteEvent() {
  if (!window.confirm(`Delete "${existing.value.title}" permanently?`)) {
    return
  }
  saving.value = true
  try {
    await deleteDoc(doc(db, 'events', eventId.value))
    router.push({ name: 'events-manage', query: { deleted: existing.value.title } })
  } catch {
    status.value = "Couldn't delete the event. Someone may have just registered - try cancelling instead."
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="container py-5" style="max-width: 48rem">
    <RouterLink class="small" :to="{ name: 'events-manage' }">&larr; Back to manage events</RouterLink>
    <h1 class="h2 fw-bold mt-2 mb-4">{{ isEdit ? 'Edit event' : 'Create an event' }}</h1>

    <p v-if="loading" class="text-muted">Loading event...</p>
    <p v-else-if="loadError" class="text-danger" role="alert">{{ loadError }}</p>
    <div v-else-if="isCancelled" class="alert alert-secondary">
      This event was cancelled, so it can no longer be edited.
    </div>

    <form v-else ref="formEl" novalidate @submit.prevent="save">
      <p class="small text-muted">All fields are required unless marked optional. Times are Melbourne time.</p>

      <div class="mb-3">
        <label class="form-label" for="title">Title</label>
        <input id="title" v-model="form.title" class="form-control" :class="{ 'is-invalid': errors.title }" v-bind="fieldAttrs('title')" maxlength="120" />
        <div v-if="errors.title" id="title-error" class="invalid-feedback">{{ errors.title }}</div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-6">
          <label class="form-label" for="type">Type</label>
          <select id="type" v-model="form.type" class="form-select" :class="{ 'is-invalid': errors.type }" v-bind="fieldAttrs('type')">
            <option v-for="option in EVENT_TYPES" :key="option">{{ option }}</option>
          </select>
          <div v-if="errors.type" id="type-error" class="invalid-feedback">{{ errors.type }}</div>
        </div>
        <div class="col-12 col-md-6">
          <label class="form-label" for="clubName">Hosting club <span class="text-muted">(optional)</span></label>
          <input id="clubName" v-model="form.clubName" class="form-control" :class="{ 'is-invalid': errors.clubName }" v-bind="fieldAttrs('clubName')" maxlength="120" />
          <div v-if="errors.clubName" id="clubName-error" class="invalid-feedback">{{ errors.clubName }}</div>
        </div>
      </div>

      <div class="mb-3">
        <label class="form-label" for="description">Description <span class="text-muted">(optional)</span></label>
        <textarea id="description" v-model="form.description" class="form-control" :class="{ 'is-invalid': errors.description }" v-bind="fieldAttrs('description')" rows="3" maxlength="2000"></textarea>
        <div v-if="errors.description" id="description-error" class="invalid-feedback">{{ errors.description }}</div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-5">
          <label class="form-label" for="venue">Venue name</label>
          <input id="venue" v-model="form.venue" class="form-control" :class="{ 'is-invalid': errors.venue }" v-bind="fieldAttrs('venue')" maxlength="120" />
          <div v-if="errors.venue" id="venue-error" class="invalid-feedback">{{ errors.venue }}</div>
        </div>
        <div class="col-12 col-md-7">
          <label class="form-label" for="address">Venue address</label>
          <input id="address" v-model="form.address" class="form-control" :class="{ 'is-invalid': errors.address }" v-bind="fieldAttrs('address')" maxlength="200" autocomplete="street-address" />
          <div v-if="errors.address" id="address-error" class="invalid-feedback">{{ errors.address }}</div>
        </div>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-12 col-md-4">
          <label class="form-label" for="date">Date</label>
          <input id="date" v-model="form.date" type="date" class="form-control" :class="{ 'is-invalid': errors.date }" v-bind="fieldAttrs('date')" />
          <div v-if="errors.date" id="date-error" class="invalid-feedback">{{ errors.date }}</div>
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label" for="startTime">Start time</label>
          <input id="startTime" v-model="form.startTime" type="time" class="form-control" :class="{ 'is-invalid': errors.startTime }" v-bind="fieldAttrs('startTime')" />
          <div v-if="errors.startTime" id="startTime-error" class="invalid-feedback">{{ errors.startTime }}</div>
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label" for="endTime">End time</label>
          <input id="endTime" v-model="form.endTime" type="time" class="form-control" :class="{ 'is-invalid': errors.endTime }" v-bind="fieldAttrs('endTime')" />
          <div v-if="errors.endTime" id="endTime-error" class="invalid-feedback">{{ errors.endTime }}</div>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-md-4">
          <label class="form-label" for="capacity">Capacity</label>
          <input id="capacity" v-model="form.capacity" type="number" min="1" max="1000" step="1" inputmode="numeric" class="form-control" :class="{ 'is-invalid': errors.capacity }" v-bind="fieldAttrs('capacity')" />
          <div v-if="errors.capacity" id="capacity-error" class="invalid-feedback">{{ errors.capacity }}</div>
          <div v-else-if="registeredCount" class="form-text">{{ registeredCount }} already registered.</div>
        </div>
        <fieldset class="col-12 col-md-8">
          <legend class="form-label fs-6">Access <span class="text-muted">(optional)</span></legend>
          <div v-for="option in ACCESS_OPTIONS" :key="option" class="form-check form-check-inline">
            <input :id="`access-${option}`" v-model="form.access" class="form-check-input" type="checkbox" :value="option" />
            <label class="form-check-label" :for="`access-${option}`">{{ option }}</label>
          </div>
        </fieldset>
      </div>

      <p class="text-danger small" role="alert">{{ status }}</p>

      <div class="d-flex gap-2">
        <button class="btn btn-success" type="submit" :disabled="saving">
          {{ saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create event' }}
        </button>
        <RouterLink class="btn btn-outline-secondary" :to="{ name: 'events-manage' }">Back</RouterLink>
      </div>
    </form>

    <section v-if="isEdit && existing && !isCancelled && !loadError" class="border border-danger-subtle rounded-3 p-3 mt-5">
      <h2 class="h6 fw-bold">Cancel or delete</h2>
      <template v-if="registeredCount === 0">
        <p class="small mb-2">Nobody has registered yet, so you can delete this event.</p>
        <button class="btn btn-outline-danger btn-sm" type="button" :disabled="saving" @click="deleteEvent">Delete event</button>
      </template>
      <template v-else>
        <p class="small mb-2">
          {{ registeredCount }} {{ registeredCount === 1 ? 'person has' : 'people have' }} registered, so this event can't be
          deleted. You can cancel it instead; it stays visible, marked as cancelled.
        </p>
        <button class="btn btn-outline-danger btn-sm" type="button" :disabled="saving" @click="cancelEvent">Cancel event</button>
      </template>
    </section>
  </div>
</template>
