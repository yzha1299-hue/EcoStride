<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore'
import { user } from '../auth/authState'
import { toEvent } from '../composables/useEvents'
import { useTable } from '../composables/useTable'
import { formatDateTime, formatLongDate, formatTimeRange } from '../utils/format'
import DataTable from '../components/DataTable.vue'

// The registrants of one of the signed-in club member's events. Firestore rules
// only let the event's creator read its registrations; the check here is just
// so a non-creator gets a clear message instead of a failed load.
const route = useRoute()
const db = getFirestore()

const event = ref(null)
const registrations = ref([])
const loading = ref(true)
const notAllowed = ref(false)
const loadError = ref('')

onMounted(async () => {
  const eventId = route.params.id
  try {
    const snapshot = await getDoc(doc(db, 'events', eventId))
    if (!snapshot.exists() || snapshot.data().createdBy !== user.value?.uid) {
      notAllowed.value = true
      return
    }
    event.value = toEvent(snapshot)
    const roster = await getDocs(collection(db, 'events', eventId, 'registrations'))
    registrations.value = roster.docs.map((registration) => {
      const data = registration.data()
      return {
        id: registration.id,
        name: data.name,
        email: data.email ?? '',
        needs: data.needs ?? '',
        registeredAt: data.registeredAt?.toDate() ?? null,
      }
    })
  } catch {
    loadError.value = 'Unable to load the roster right now. Please try again.'
  } finally {
    loading.value = false
  }
})

const table = useTable(
  registrations,
  [
    { key: 'name', label: 'Name', text: (row) => row.name },
    { key: 'email', label: 'Email', text: (row) => row.email },
    { key: 'needs', label: 'Needs', text: (row) => row.needs },
    {
      key: 'registeredAt',
      label: 'Registered (Melbourne time)',
      text: (row) => (row.registeredAt ? formatDateTime(row.registeredAt) : ''),
      sortValue: (row) => row.registeredAt,
    },
  ],
  { initialSort: { key: 'registeredAt', dir: 'asc' } },
)
</script>

<template>
  <div class="container py-5">
    <RouterLink class="small" :to="{ name: 'events-manage' }">&larr; Back to manage events</RouterLink>

    <p v-if="loading" class="text-muted mt-3">Loading roster...</p>

    <div v-else-if="notAllowed" class="alert alert-warning mt-3" role="alert">
      <h1 class="h5 fw-bold">You can't view this roster</h1>
      <p class="mb-0">
        Only the club member who created an event can see who registered for it. This event doesn't exist or
        belongs to someone else.
      </p>
    </div>

    <p v-else-if="loadError" class="text-danger mt-3" role="alert">{{ loadError }}</p>

    <template v-else>
      <h1 class="h2 fw-bold mt-2 mb-1">Roster: {{ event.title }}</h1>
      <p class="text-muted mb-4">
        {{ formatLongDate(event.startsAt) }}, {{ formatTimeRange(event.startsAt, event.endsAt) }} ·
        {{ event.venue }} · {{ event.registeredCount }}/{{ event.capacity }} registered
        <span v-if="event.status === 'cancelled'" class="badge text-bg-danger ms-1">Cancelled</span>
      </p>

      <p v-if="!registrations.length" class="text-muted">Nobody has registered for this event yet.</p>
      <DataTable v-else :table="table" :caption="`Registrants for ${event.title}`" />
    </template>
  </div>
</template>
