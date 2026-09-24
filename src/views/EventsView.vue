<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useEvents } from '../composables/useEvents'
import { useRatings } from '../composables/useRatings'
import { useAuth } from '../auth/authState'
import { formatEventDay, formatLongDate, formatTimeRange } from '../utils/format'
import { EVENT_STATE, eventState, placesLeft } from '../../shared/eventState'
import StarRating from '../components/StarRating.vue'

const { events, loading, error } = useEvents()
const { isAuthenticated } = useAuth()

const query = ref('')
const type = ref('All')
const access = ref('Any')

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
    return matchesSearch && matchesType && matchesAccess
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
        </form>
      </div>
    </section>

    <section class="py-4 py-lg-5">
      <div class="container">
        <p v-if="loading" class="text-muted">Loading events...</p>
        <p v-else-if="error" class="text-danger">{{ error }}</p>
        <p v-else-if="!filteredEvents.length && query" class="text-muted">
          No events match "{{ query }}".
        </p>
        <p v-else-if="!filteredEvents.length" class="text-muted">No events match your filters.</p>

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
                        <span class="small text-muted">Your rating:</span>
                        <StarRating
                          :value="ratingsByEvent[event.id].userRating"
                          :disabled="ratingsByEvent[event.id].submitting"
                          @rate="(value) => ratingsByEvent[event.id].submit(value)"
                        />
                        <span
                          v-if="ratingsByEvent[event.id].feedback"
                          class="small text-success"
                        >
                          {{ ratingsByEvent[event.id].feedback }}
                        </span>
                      </div>
                      <p v-else class="small text-muted mt-1 mb-0">
                        <RouterLink to="/FireLogin">Sign in</RouterLink> to rate this event.
                      </p>
                    </div>
                  </div>
                  <!-- Registration itself arrives with the registration API. -->
                  <button
                    v-if="eventState(event) === EVENT_STATE.OPEN"
                    class="btn btn-sm btn-success align-self-start"
                    type="button"
                    disabled
                  >
                    Register
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
