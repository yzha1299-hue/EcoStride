<script setup>
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore'
import { emailVerified, user } from '../auth/authState'
import { emailRosterToMe } from '../api/client'
import { toEvent } from '../composables/useEvents'
import { useTable } from '../composables/useTable'
import { formatDateTime, formatLongDate, formatTimeRange } from '../utils/format'
import DataTable from '../components/DataTable.vue'
import TableExport from '../components/TableExport.vue'
import VerifyEmailPrompt from '../components/VerifyEmailPrompt.vue'

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

// "Email me the roster": the server builds the CSV and sends it to the
// signed-in user's own verified address.
const emailing = ref(false)
const emailStatus = ref('')
const emailFailed = ref(false)

async function emailRoster() {
  emailing.value = true
  emailStatus.value = ''
  emailFailed.value = false
  try {
    const { sentTo, count } = await emailRosterToMe(route.params.id)
    emailStatus.value = `Roster (${count} registrant${count === 1 ? '' : 's'}) sent to ${sentTo}.`
  } catch (error) {
    emailFailed.value = true
    emailStatus.value = error.message
  } finally {
    emailing.value = false
  }
}

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

      <section class="border rounded-3 p-3 mb-4" aria-labelledby="roster-email-heading">
        <div class="d-flex flex-wrap justify-content-between align-items-start gap-2">
          <h2 id="roster-email-heading" class="h6 fw-bold">Email</h2>
          <RouterLink
            v-if="registrations.length"
            class="btn btn-success btn-sm"
            :to="{ name: 'event-email', params: { id: route.params.id } }"
          >
            Email all registrants
          </RouterLink>
        </div>
        <VerifyEmailPrompt v-if="!emailVerified" />
        <template v-else>
          <p class="small text-muted mb-2">
            Sends the full roster as a CSV file to your own address, {{ user?.email }}.
          </p>
          <button class="btn btn-outline-success btn-sm" type="button" :disabled="emailing" @click="emailRoster">
            {{ emailing ? 'Sending...' : 'Email me the roster' }}
          </button>
        </template>
        <p class="small mt-2 mb-0" :class="emailFailed ? 'text-danger' : 'text-success'" role="status">
          {{ emailStatus }}
        </p>
      </section>

      <p v-if="!registrations.length" class="text-muted">Nobody has registered for this event yet.</p>
      <template v-else>
        <TableExport
          class="mb-3"
          :table="table"
          :name="`roster ${event.title}`"
          :title="`Roster: ${event.title} (${formatLongDate(event.startsAt)})`"
        />
        <DataTable :table="table" :caption="`Registrants for ${event.title}`" />
      </template>
    </template>
  </div>
</template>
