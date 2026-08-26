<script setup>
import { computed, ref } from 'vue'
import { useJsonData } from '../composables/useJsonData'

const { data, loading, error } = useJsonData('events')

const query = ref('')
const type = ref('All')
const access = ref('Any')

const events = computed(() => data.value?.events ?? [])

const typeOptions = computed(() => ['All', ...new Set(events.value.map((event) => event.type))])
const accessOptions = computed(() => [
  'Any',
  ...new Set(events.value.flatMap((event) => event.access ?? [])),
])

const filteredEvents = computed(() => {
  const search = query.value.trim().toLowerCase()

  return events.value.filter((event) => {
    const title = (event.title ?? '').toLowerCase()
    const matchesSearch = !search || title.includes(search)
    const matchesType = type.value === 'All' || event.type === type.value
    const matchesAccess = access.value === 'Any' || event.access.includes(access.value)
    return matchesSearch && matchesType && matchesAccess
  })
})

function applyFilters() {
  query.value = query.value.trim()
  type.value = type.value
  access.value = access.value
}

function eventMeta(event) {
  const accessLabel = event.access[0] ?? ''
  const waitlist = event.status === 'waitlist' ? 'Waitlist' : accessLabel
  const place = event.suburb || event.venue
  return `${place} · ${event.weekday} ${event.day} ${event.month} · Capacity ${event.registered}/${event.capacity}${
    waitlist ? ` · ${waitlist}` : ''
  }`
}
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
              placeholder="Workshop, suburb, club..."
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
        <p v-else-if="!filteredEvents.length" class="text-muted">No events match your filters.</p>

        <div v-else class="d-flex flex-column gap-3">
          <article v-for="event in filteredEvents" :key="event.id" class="card shadow-sm">
            <div class="row g-0 align-items-center">
              <div class="col-4 col-sm-3 col-lg-2">
                <div class="date-badge">
                  <span class="date-badge-month">{{ event.month }}</span>
                  <span class="date-badge-day">{{ event.day }}</span>
                  <span class="date-badge-week">{{ event.weekday }}</span>
                </div>
              </div>
              <div class="col-8 col-sm-9 col-lg-10">
                <div class="card-body d-flex flex-column flex-md-row align-items-md-center gap-3">
                  <div class="flex-grow-1">
                    <h2 class="h5 fw-bold mb-1">{{ event.title }}</h2>
                    <p class="small text-muted mb-0">{{ eventMeta(event) }}</p>
                  </div>
                  <a
                    class="btn btn-sm align-self-start"
                    :class="event.status === 'waitlist' ? 'btn-outline-success' : 'btn-success'"
                    href="#"
                  >
                    {{ event.status === 'waitlist' ? 'Join waitlist' : 'Register' }}
                  </a>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
