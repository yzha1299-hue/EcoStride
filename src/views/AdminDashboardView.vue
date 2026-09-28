<script setup>
import { computed, onMounted, ref } from 'vue'
import { collection, getCountFromServer, getDocs, getFirestore, query, where } from 'firebase/firestore'
import { Bar } from 'vue-chartjs'
import { ROLE_LABELS, ROLES } from '../auth/authState'
import { useEvents } from '../composables/useEvents'
import { eventsByType, roleCounts, signupsPerWeek, summariseEvents } from '../utils/dashboard'
import { formatNumber } from '../utils/format'
import { barOptions, CHART_COLORS } from '../utils/charts'
import ChartPanel from '../components/ChartPanel.vue'

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

// Sign-up dates for the weekly chart. Only createdAt is used; nothing else
// from the profiles is shown.
const signupDates = ref([])
const signupsError = ref('')
onMounted(async () => {
  try {
    const snapshot = await getDocs(collection(getFirestore(), 'users'))
    signupDates.value = snapshot.docs.map((doc) => ({ createdAt: doc.data().createdAt?.toDate() ?? null }))
  } catch {
    signupsError.value = 'Unable to load sign-up dates right now.'
  }
})

// --- Charts -------------------------------------------------------------

const roleData = computed(() =>
  roleCounts(Object.fromEntries((userCounts.value?.byRole ?? []).map((item) => [item.role, item.count]))),
)
const roleChart = computed(() => ({
  labels: roleData.value.map((r) => r.label),
  datasets: [{ label: 'Users', data: roleData.value.map((r) => r.count), backgroundColor: CHART_COLORS.green }],
}))
const roleSummary = computed(() =>
  roleData.value.map((r) => `${r.count} ${r.label.toLowerCase()}`).join(', ') + '.',
)

const WEEKS = 12
const weeks = computed(() => signupsPerWeek(signupDates.value, { weeks: WEEKS }))
const signupTotal = computed(() => weeks.value.reduce((sum, w) => sum + w.count, 0))
const signupChart = computed(() => ({
  labels: weeks.value.map((w) => w.label),
  datasets: [{ label: 'New sign-ups', data: weeks.value.map((w) => w.count), backgroundColor: CHART_COLORS.blue }],
}))
const signupSummary = computed(() => {
  const busiest = weeks.value.reduce((best, w) => (w.count > best.count ? w : best), weeks.value[0])
  return signupTotal.value
    ? `${signupTotal.value} sign-ups in the last ${WEEKS} weeks; the busiest week began ${busiest.label} with ${busiest.count}.`
    : `No sign-ups in the last ${WEEKS} weeks.`
})

const typeGroups = computed(() => eventsByType(events.value))
const typeChart = computed(() => ({
  labels: typeGroups.value.map((g) => g.type),
  datasets: [
    { label: 'Registrations', data: typeGroups.value.map((g) => g.registrations), backgroundColor: CHART_COLORS.green },
    { label: 'Places left', data: typeGroups.value.map((g) => g.placesLeft), backgroundColor: CHART_COLORS.grey },
  ],
}))
const typeSummary = computed(() =>
  typeGroups.value
    .map((g) => `${g.type}: ${g.events} event${g.events === 1 ? '' : 's'}, ${g.registrations} registered, ${g.placesLeft} places left`)
    .join('; ') + '.',
)
const typeRows = computed(() => typeGroups.value.map((g) => ({ ...g })))

const plainBars = barOptions()
const stackedBars = barOptions({ stacked: true, legend: true })

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

    <section class="mt-5" aria-labelledby="charts-heading">
      <h2 id="charts-heading" class="h4 fw-bold mb-1">Trends</h2>
      <p class="small text-muted mb-3">Hover over a bar for exact numbers, or use "Show as table".</p>
      <div class="row g-3">
        <div class="col-12 col-lg-4">
          <ChartPanel
            title="Users by role"
            :summary="usersError ? usersError : roleSummary"
            :columns="[{ key: 'label', label: 'Role' }, { key: 'count', label: 'Users' }]"
            :rows="roleData"
            :empty="!userCounts"
            :empty-text="usersLoading ? 'Loading...' : 'No user numbers available.'"
          >
            <template #default="{ describedBy }">
              <Bar :data="roleChart" :options="plainBars" aria-label="Bar chart: users by role" :aria-describedby="describedBy" />
            </template>
          </ChartPanel>
        </div>
        <div class="col-12 col-lg-4">
          <ChartPanel
            title="New sign-ups per week"
            :summary="signupsError || signupSummary"
            :columns="[{ key: 'weekStart', label: 'Week starting' }, { key: 'count', label: 'Sign-ups' }]"
            :rows="weeks"
            :empty="Boolean(signupsError)"
          >
            <template #default="{ describedBy }">
              <Bar :data="signupChart" :options="plainBars" aria-label="Bar chart: new sign-ups per week" :aria-describedby="describedBy" />
            </template>
          </ChartPanel>
        </div>
        <div class="col-12 col-lg-4">
          <ChartPanel
            title="Upcoming events by type"
            :summary="typeGroups.length ? typeSummary : 'No upcoming events.'"
            :columns="[
              { key: 'type', label: 'Type' },
              { key: 'events', label: 'Events' },
              { key: 'registrations', label: 'Registrations' },
              { key: 'placesLeft', label: 'Places left' },
            ]"
            :rows="typeRows"
            :empty="!typeGroups.length"
            :empty-text="eventsLoading ? 'Loading...' : 'No upcoming events to show.'"
          >
            <template #default="{ describedBy }">
              <Bar :data="typeChart" :options="stackedBars" aria-label="Stacked bar chart: registrations and places left by event type" :aria-describedby="describedBy" />
            </template>
          </ChartPanel>
        </div>
      </div>
    </section>
  </div>
</template>
