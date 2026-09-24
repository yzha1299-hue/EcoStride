<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { user } from '../auth/authState'
import { useEvents } from '../composables/useEvents'
import { formatEventDay, formatTimeRange } from '../utils/format'
import { EVENT_STATE, eventState } from '../../shared/eventState'

const route = useRoute()
const { events, loading, error } = useEvents({ createdBy: user.value.uid })

const STATE_LABELS = {
  [EVENT_STATE.OPEN]: { label: 'Open', class: 'text-bg-success' },
  [EVENT_STATE.FULL]: { label: 'Full', class: 'text-bg-warning' },
  [EVENT_STATE.CLOSED]: { label: 'Started or past', class: 'text-bg-secondary' },
  [EVENT_STATE.CANCELLED]: { label: 'Cancelled', class: 'text-bg-danger' },
}

// One-off confirmation after returning from the form, e.g. ?saved=Title.
const notice = computed(() => {
  const { saved, cancelled, deleted } = route.query
  if (saved) return `Saved "${saved}".`
  if (cancelled) return `Cancelled "${cancelled}".`
  if (deleted) return `Deleted "${deleted}".`
  return ''
})

function when(event) {
  const day = formatEventDay(event.startsAt)
  return `${day.weekday} ${day.day} ${day.month}, ${formatTimeRange(event.startsAt, event.endsAt)}`
}
</script>

<template>
  <div class="container py-5">
    <div class="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
      <div>
        <h1 class="h2 fw-bold mb-2">Manage events</h1>
        <p class="text-muted mb-0">Events you've created. Times are Melbourne time.</p>
      </div>
      <RouterLink class="btn btn-success" :to="{ name: 'event-create' }">Create event</RouterLink>
    </div>

    <p class="text-success" role="status">{{ notice }}</p>

    <p v-if="loading" class="text-muted">Loading events...</p>
    <p v-else-if="error" class="text-danger">{{ error }}</p>
    <p v-else-if="!events.length" class="text-muted">You haven't created any events yet.</p>

    <div v-else class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">When</th>
            <th scope="col">Registered</th>
            <th scope="col">Status</th>
            <th scope="col"><span class="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.id">
            <td>
              <div class="fw-semibold">{{ event.title }}</div>
              <div class="small text-muted">{{ event.venue }}</div>
            </td>
            <td>{{ when(event) }}</td>
            <td>{{ event.registeredCount }}/{{ event.capacity }}</td>
            <td>
              <span class="badge" :class="STATE_LABELS[eventState(event)].class">
                {{ STATE_LABELS[eventState(event)].label }}
              </span>
            </td>
            <td class="text-end">
              <RouterLink
                v-if="event.status !== 'cancelled'"
                class="btn btn-outline-success btn-sm"
                :to="{ name: 'event-edit', params: { id: event.id } }"
              >
                Edit<span class="visually-hidden"> {{ event.title }}</span>
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
