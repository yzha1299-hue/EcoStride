<script setup>
import { computed } from 'vue'
import { useJsonData } from '../composables/useJsonData'

const { data, loading, error } = useJsonData('events')

const events = computed(() => data.value?.events ?? [])

function occupancy(event) {
  return Math.round((event.registered / event.capacity) * 100)
}
</script>

<template>
  <div class="container py-5">
    <div class="mb-4">
      <h1 class="h2 fw-bold mb-2">Manage events</h1>
      <p class="text-muted mb-0">
        Club member tools for reviewing rosters and capacity across upcoming sessions.
      </p>
    </div>

    <p v-if="loading" class="text-muted">Loading events...</p>
    <p v-else-if="error" class="text-danger">{{ error }}</p>

    <div v-else class="table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Club</th>
            <th scope="col">Capacity</th>
            <th scope="col">Status</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in events" :key="event.id">
            <td>
              <div class="fw-semibold">{{ event.title }}</div>
              <div class="small text-muted">{{ event.suburb }} · {{ event.venue }}</div>
            </td>
            <td>{{ event.club || '—' }}</td>
            <td>{{ event.registered }}/{{ event.capacity }} ({{ occupancy(event) }}%)</td>
            <td>
              <span
                class="badge"
                :class="event.status === 'waitlist' ? 'text-bg-warning' : 'text-bg-success'"
              >
                {{ event.status === 'waitlist' ? 'Waitlist' : 'Open' }}
              </span>
            </td>
            <td class="text-end">
              <a class="btn btn-outline-success btn-sm" href="#">Export roster</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
