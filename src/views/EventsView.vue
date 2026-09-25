<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useEvents } from '../composables/useEvents'
import { useMyRegistrations } from '../composables/useMyRegistrations'
import { useRatings } from '../composables/useRatings'
import { useAuth, user } from '../auth/authState'
import { cancelRegistration } from '../api/client'
import { formatEventDay, formatLongDate, formatTimeRange } from '../utils/format'
import { EVENT_STATE, eventState, placesLeft } from '../../shared/eventState'
import StarRating from '../components/StarRating.vue'
import RegistrationDialog from '../components/RegistrationDialog.vue'
import EventsMap from '../components/EventsMap.vue'

const { events, loading, error } = useEvents()
const { isAuthenticated } = useAuth()
const { registeredIds, setRegistered } = useMyRegistrations(events)

const query = ref('')
const type = ref('All')
const access = ref('Any')
const myEventsOnly = ref(false)
// 'list' or 'map'
const view = ref('list')

const typeOptions = computed(() => ['All', ...new Set(events.value.map((event) => event.type))])
const accessOptions = computed(() => [
  'Any',
  ...new Set(events.value.flatMap((event) => event.access ?? [])),
])

const filteredEvents = computed(() => {
  const search = query.value.trim().toLowerCase()

  return events.value.filter((event) => {
    const haystack = [event.title, event.venue, event.address, event.clubName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    const matchesSearch = !search || haystack.includes(search)
    const matchesType = type.value === 'All' || event.type === type.value
    const matchesAccess = access.value === 'Any' || (event.access ?? []).includes(access.value)
    const matchesMine = !myEventsOnly.value || registeredIds.value.has(event.id)
    return matchesSearch && matchesType && matchesAccess && matchesMine
  })
})

function applyFilters() {
  query.value = query.value.trim()
}

const STATE_BADGES = {
  [EVENT_STATE.OPEN]: { label: 'Open', class: 'text-bg-success' },
  [EVENT_STATE.FULL]: { label: 'Full', class: 'text-bg-warning' },
  [EVENT_STATE.CLOSED]: { label: 'Registration closed', class: 'text-bg-secondary' },
  [EVENT_STATE.CANCELLED]: { label: 'Cancelled', class: 'text-bg-danger' },
}

function stateBadge(event) {
  return STATE_BADGES[eventState(event)]
}

function eventMeta(event) {
  const parts = [event.venue, formatTimeRange(event.startsAt, event.endsAt)]
  if (eventState(event) === EVENT_STATE.OPEN) {
    const left = placesLeft(event)
    parts.push(`${left} place${left === 1 ? '' : 's'} left of ${event.capacity}`)
  }
  if (event.access?.length) {
    parts.push(event.access.join(', '))
  }
  return parts.join(' · ')
}

function isOwnEvent(event) {
  return event.createdBy === user.value?.uid
}

function isRegistered(event) {
  return registeredIds.value.has(event.id)
}

function canRegister(event) {
  return eventState(event) === EVENT_STATE.OPEN && !isOwnEvent(event) && !isRegistered(event)
}

// Registered people can give their place back until the event starts.
function canCancel(event) {
  const state = eventState(event)
  return isRegistered(event) && (state === EVENT_STATE.OPEN || state === EVENT_STATE.FULL)
}

// Registration outcomes are announced in a live region.
const announcement = ref('')
const announcementIsError = ref(false)

// Screen readers drop a queued live-region update when focus moves (NVDA
// cancels speech on every focus change), so when an action also moves focus,
// the message is written only after the new focus has been announced. Clearing
// first means a repeat of the same message is still read out.
const AFTER_FOCUS_DELAY_MS = 600
let announceTimer = null

function announce(message, isError = false, { afterFocusMove = false } = {}) {
  clearTimeout(announceTimer)
  announcement.value = ''
  announcementIsError.value = isError
  if (!message) return
  announceTimer = setTimeout(
    () => {
      announcement.value = message
    },
    afterFocusMove ? AFTER_FOCUS_DELAY_MS : 50,
  )
}

// After registering or cancelling, the button that was pressed is replaced
// by its opposite; keep keyboard focus on the card by moving it there.
async function focusCardAction(id) {
  await nextTick()
  document.getElementById(id)?.focus()
}

const registeringEvent = ref(null)

function openRegistration(event) {
  announce('')
  registeringEvent.value = event
}

async function onRegistered(result) {
  const event = registeringEvent.value
  if (typeof result.registeredCount === 'number') {
    event.registeredCount = result.registeredCount
  }
  setRegistered(event.id, true)
  registeringEvent.value = null
  await focusCardAction(`cancel-${event.id}`)
  announce(`You're registered for ${event.title}.`, false, { afterFocusMove: true })
}

function onFull() {
  registeringEvent.value.registeredCount = registeringEvent.value.capacity
}

const cancellingId = ref('')

async function cancel(event) {
  if (!window.confirm(`Cancel your registration for "${event.title}"? Your place will go to someone else.`)) {
    return
  }
  cancellingId.value = event.id
  announce('')
  try {
    const result = await cancelRegistration(event.id)
    event.registeredCount = result.registeredCount
    setRegistered(event.id, false)
    cancellingId.value = ''
    await focusCardAction(`register-${event.id}`)
    announce(`Your registration for ${event.title} has been cancelled.`, false, { afterFocusMove: true })
  } catch (cancelError) {
    if (cancelError.code === 'NOT_REGISTERED') {
      setRegistered(event.id, false)
    }
    announce(cancelError.message, true)
  } finally {
    cancellingId.value = ''
  }
}

const ratingsByEvent = reactive({})

watch(
  events,
  (list) => {
    list.forEach((event) => {
      if (!ratingsByEvent[event.id]) {
        ratingsByEvent[event.id] = useRatings('eventRatings', event.id)
      }
    })
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <section class="hero-section border-bottom">
      <div class="container py-4 py-lg-5">
        <h1 class="h2 fw-bold mb-2">Upcoming events</h1>
        <p class="text-muted mb-4">Active travel workshops and club sustainability sessions.</p>

        <form class="row g-3 align-items-end" @submit.prevent="applyFilters">
          <div class="col-12 col-md-4">
            <label class="form-label" for="eventSearch">Search</label>
            <input
              id="eventSearch"
              v-model="query"
              class="form-control"
              type="search"
              placeholder="Workshop, venue, suburb, club..."
            />
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <label class="form-label" for="eventType">Type</label>
            <select id="eventType" v-model="type" class="form-select">
              <option v-for="option in typeOptions" :key="option">{{ option }}</option>
            </select>
          </div>
          <div class="col-12 col-sm-6 col-md-3">
            <label class="form-label" for="eventAccess">Access</label>
            <select id="eventAccess" v-model="access" class="form-select">
              <option v-for="option in accessOptions" :key="option">{{ option }}</option>
            </select>
          </div>
          <div class="col-12 col-md-2">
            <button class="btn btn-success w-100" type="submit">Filter</button>
          </div>
          <div class="col-12">
            <div class="form-check form-switch">
              <input id="myEventsOnly" v-model="myEventsOnly" class="form-check-input" type="checkbox" role="switch" />
              <label class="form-check-label" for="myEventsOnly">My events (only events I'm registered for)</label>
            </div>
          </div>
        </form>
      </div>
    </section>

    <section class="py-4 py-lg-5">
      <div class="container">
        <p
          class="alert py-2"
          :class="[announcementIsError ? 'alert-danger' : 'alert-success', { 'visually-hidden': !announcement }]"
          role="status"
        >
          {{ announcement }}
        </p>

        <div class="btn-group mb-3" role="group" aria-label="Show events as">
          <button
            v-for="option in ['list', 'map']"
            :key="option"
            type="button"
            class="btn btn-sm"
            :class="view === option ? 'btn-success' : 'btn-outline-success'"
            :aria-pressed="view === option ? 'true' : 'false'"
            @click="view = option"
          >
            {{ option === 'list' ? 'List' : 'Map' }}
          </button>
        </div>

        <p v-if="loading" class="text-muted">Loading events...</p>
        <p v-else-if="error" class="text-danger">{{ error }}</p>
        <p v-else-if="!filteredEvents.length && myEventsOnly" class="text-muted">
          You aren't registered for any upcoming events that match your filters.
        </p>
        <p v-else-if="!filteredEvents.length && query" class="text-muted">
          No events match "{{ query }}".
        </p>
        <p v-else-if="!filteredEvents.length" class="text-muted">No events match your filters.</p>

        <EventsMap v-else-if="view === 'map'" :events="filteredEvents" />

        <div v-else class="d-flex flex-column gap-3">
          <article v-for="event in filteredEvents" :key="event.id" class="card shadow-sm">
            <div class="row g-0 align-items-center">
              <div class="col-4 col-sm-3 col-lg-2">
                <div class="date-badge">
                  <span class="visually-hidden">{{ formatLongDate(event.startsAt) }}</span>
                  <span class="date-badge-month" aria-hidden="true">{{ formatEventDay(event.startsAt).month }}</span>
                  <span class="date-badge-day" aria-hidden="true">{{ formatEventDay(event.startsAt).day }}</span>
                  <span class="date-badge-week" aria-hidden="true">{{ formatEventDay(event.startsAt).weekday }}</span>
                </div>
              </div>
              <div class="col-8 col-sm-9 col-lg-10">
                <div class="card-body d-flex flex-column flex-md-row align-items-md-center gap-3">
                  <div class="flex-grow-1">
                    <h2 class="h5 fw-bold mb-1">
                      {{ event.title }}
                      <span class="badge ms-1 align-middle" :class="stateBadge(event).class">
                        {{ stateBadge(event).label }}
                      </span>
                      <span v-if="isRegistered(event)" class="badge ms-1 align-middle text-bg-primary">Registered</span>
                      <span v-else-if="isOwnEvent(event)" class="badge ms-1 align-middle text-bg-light border">Your event</span>
                    </h2>
                    <p v-if="event.clubName" class="small mb-1">Hosted by {{ event.clubName }}</p>
                    <p class="small text-muted mb-0">{{ eventMeta(event) }}</p>

                    <div v-if="ratingsByEvent[event.id]" class="mt-2">
                      <div class="d-flex align-items-center gap-2">
                        <StarRating :value="ratingsByEvent[event.id].average" readonly />
                        <span class="small text-muted">
                          {{ ratingsByEvent[event.id].average.toFixed(1) }}
                          ({{ ratingsByEvent[event.id].count }}
                          rating{{ ratingsByEvent[event.id].count === 1 ? '' : 's' }})
                        </span>
                      </div>

                      <div v-if="isAuthenticated" class="d-flex align-items-center gap-2 mt-1">
                        <span class="small text-muted" aria-hidden="true">Your rating:</span>
                        <StarRating
                          :value="ratingsByEvent[event.id].userRating"
                          :disabled="ratingsByEvent[event.id].submitting"
                          :label="`Your rating for ${event.title}`"
                          @rate="(value) => ratingsByEvent[event.id].submit(value)"
                        />
                        <span class="small text-success" role="status">
                          {{ ratingsByEvent[event.id].feedback }}
                        </span>
                      </div>
                      <p v-else class="small text-muted mt-1 mb-0">
                        <RouterLink to="/FireLogin">Sign in</RouterLink> to rate this event.
                      </p>
                    </div>
                  </div>
                  <button
                    v-if="canRegister(event)"
                    :id="`register-${event.id}`"
                    class="btn btn-sm btn-success align-self-start text-nowrap"
                    type="button"
                    :aria-label="`Register for ${event.title}`"
                    @click="openRegistration(event)"
                  >
                    Register
                  </button>
                  <button
                    v-else-if="canCancel(event)"
                    :id="`cancel-${event.id}`"
                    class="btn btn-sm btn-outline-danger align-self-start text-nowrap"
                    type="button"
                    :aria-label="`Cancel registration for ${event.title}`"
                    :disabled="cancellingId === event.id"
                    @click="cancel(event)"
                  >
                    {{ cancellingId === event.id ? 'Cancelling...' : 'Cancel registration' }}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <RegistrationDialog
      :event="registeringEvent"
      @registered="onRegistered"
      @full="onFull"
      @close="registeringEvent = null"
    />
  </div>
</template>
