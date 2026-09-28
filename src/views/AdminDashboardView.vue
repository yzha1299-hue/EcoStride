<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, getCountFromServer, getFirestore, query, where } from 'firebase/firestore'
import { ROLE_LABELS, ROLES } from '../auth/authState'
import { useEvents } from '../composables/useEvents'
import { summariseEvents } from '../utils/dashboard'
import { formatNumber } from '../utils/format'

// Overview for EcoStride staff: who uses the platform and how events are
// filling up. User numbers come from Firestore count queries (the rules let
// only admins run them); event numbers from the upcoming events.
const userCounts = ref(null)
const usersLoading = ref(true)
const usersError = ref('')

const ROLE_ORDER = [ROLES.PARTICIPANT, ROLES.CLUB_MEMBER, ROLES.ADMIN]

onMounted(async () => {
  const users = collection(getFirestore(), 'users')
  try {
    const [total, ...byRole] = await Promise.all([
      getCountFromServer(users),
      ...ROLE_ORDER.map((role) => getCountFromServer(query(users, where('role', '==', role)))),
    ])
    userCounts.value = {
      total: total.data().count,
      byRole: ROLE_ORDER.map((role, i) => ({ role, label: ROLE_LABELS[role], count: byRole[i].data().count })),
    }
  } catch {
    usersError.value = 'Unable to load user numbers right now. Please try again.'
  } finally {
    usersLoading.value = false
  }
})

const { events, loading: eventsLoading, error: eventsError } = useEvents()
const eventSummary = computed(() => summariseEvents(events.value))

const percent = (part, whole) => (whole ? Math.round((part / whole) * 100) : 0)
</script>

<template>
  <div class="container py-5">
    <h1 class="h2 fw-bold mb-1">Admin dashboard</h1>
    <p class="text-muted mb-4">An overview of EcoStride: who uses it and how upcoming events are filling up.</p>

    <section class="mb-5" aria-labelledby="users-heading">
      <h2 id="users-heading" class="h4 fw-bold mb-3">Users</h2>
      <p v-if="usersLoading" class="text-muted">Loading user numbers...</p>
      <p v-else-if="usersError" class="text-danger" role="alert">{{ usersError }}</p>
      <div v-else class="row g-3">
        <div class="col-12 col-md-3">
          <div class="stat-card text-center p-4 h-100">
            <p class="display-6 fw-bold text-success mb-0">{{ formatNumber(userCounts.total) }}</p>
            <p class="text-muted mb-0">users in total</p>
          </div>
        </div>
        <div v-for="item in userCounts.byRole" :key="item.role" class="col-12 col-sm-4 col-md-3">
          <div class="stat-card text-center p-4 h-100">
            <p class="h2 fw-bold mb-0">{{ formatNumber(item.count) }}</p>
            <p class="text-muted mb-0">
              {{ item.label }}{{ item.count === 1 ? '' : 's' }}
              <span class="d-block small">{{ percent(item.count, userCounts.total) }}% of users</span>
            </p>
          </div>
        </div>
      </div>
      <p v-if="userCounts" class="small text-muted mt-2 mb-0">
        Counts accounts that have finished sign-up (chosen a role). Someone who signed in with Google but
        closed the page before choosing a role isn't counted until they do.
      </p>
    </section>

    <section aria-labelledby="events-heading">
      <h2 id="events-heading" class="h4 fw-bold mb-3">Upcoming events</h2>
      <p v-if="eventsLoading" class="text-muted">Loading events...</p>
      <p v-else-if="eventsError" class="text-danger" role="alert">{{ eventsError }}</p>
      <template v-else>
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="stat-card text-center p-4 h-100">
              <p class="h2 fw-bold mb-0">{{ formatNumber(eventSummary.upcoming) }}</p>
              <p class="text-muted mb-0">upcoming events</p>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card text-center p-4 h-100">
              <p class="h2 fw-bold mb-0">{{ formatNumber(eventSummary.registrations) }}</p>
              <p class="text-muted mb-0">registrations</p>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card text-center p-4 h-100">
              <p class="h2 fw-bold mb-0">{{ formatNumber(eventSummary.places) }}</p>
              <p class="text-muted mb-0">places offered</p>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card text-center p-4 h-100">
              <p class="h2 fw-bold mb-0">{{ eventSummary.fillRate === null ? '-' : `${eventSummary.fillRate}%` }}</p>
              <p class="text-muted mb-0">of places taken</p>
            </div>
          </div>
        </div>
        <p class="small text-muted mt-2 mb-0">
          {{ eventSummary.full }} event{{ eventSummary.full === 1 ? ' is' : 's are' }} full.
          <template v-if="eventSummary.cancelled">
            {{ eventSummary.cancelled }} cancelled event{{ eventSummary.cancelled === 1 ? ' is' : 's are' }} not counted.
          </template>
        </p>
      </template>
    </section>
  </div>
</template>
