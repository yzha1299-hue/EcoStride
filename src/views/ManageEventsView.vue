<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bar } from 'vue-chartjs'
import { user } from '../auth/authState'
import { useEvents } from '../composables/useEvents'
import { useTable } from '../composables/useTable'
import { formatEventDay, formatTimeRange } from '../utils/format'
import { EVENT_STATE, eventState } from '../../shared/eventState'
import { registrationBars } from '../utils/dashboard'
import { barOptions, CHART_COLORS } from '../utils/charts'
import DataTable from '../components/DataTable.vue'
import TableExport from '../components/TableExport.vue'
import ChartPanel from '../components/ChartPanel.vue'

const route = useRoute()
const router = useRouter()
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

const stateOf = (event) => STATE_LABELS[eventState(event)]

// Registrations against capacity for events still to come. Clicking a bar
// opens that event's roster; keyboard users reach the same rosters from the
// table below (Roster buttons) and the chart's own table alternative.
const bars = computed(() => registrationBars(events.value))
const barChart = computed(() => ({
  labels: bars.value.map((bar) => bar.label),
  datasets: [
    { label: 'Registered', data: bars.value.map((bar) => bar.registered), backgroundColor: CHART_COLORS.green },
    { label: 'Places left', data: bars.value.map((bar) => bar.placesLeft), backgroundColor: CHART_COLORS.grey },
  ],
}))
const barSummary = computed(() => {
  const full = bars.value.filter((bar) => bar.placesLeft === 0).length
  const quiet = bars.value.filter((bar) => bar.fillPercent < 25)
  const parts = [`${bars.value.length} upcoming event${bars.value.length === 1 ? '' : 's'}`]
  parts.push(`${full} full`)
  if (quiet.length) parts.push(`under a quarter full: ${quiet.map((bar) => bar.title).join(', ')}`)
  return `${parts.join('; ')}. Select a bar to open its roster.`
})
const barRows = computed(() =>
  bars.value.map((bar) => ({ ...bar, fill: `${bar.fillPercent}%` })),
)
const barChartOptions = computed(() => {
  const base = barOptions({ stacked: true, legend: true, horizontal: true })
  return {
    ...base,
    plugins: {
      ...base.plugins,
      tooltip: {
        callbacks: {
          title: (items) => bars.value[items[0].dataIndex].title,
          footer: (items) => `${bars.value[items[0].dataIndex].fillPercent}% full - click to open the roster`,
        },
      },
    },
    onClick: (_event, elements) => {
      const bar = bars.value[elements[0]?.index]
      if (bar) router.push({ name: 'event-roster', params: { id: bar.id } })
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
  }
})
// Enough room for each bar and its label.
const barHeight = computed(() => `${Math.max(10, bars.value.length * 2.75 + 5)}rem`)

const table = useTable(
  events,
  [
    { key: 'title', label: 'Event', text: (event) => event.title },
    { key: 'venue', label: 'Venue', text: (event) => event.venue },
    { key: 'when', label: 'When', text: when, sortValue: (event) => event.startsAt },
    {
      key: 'registered',
      label: 'Registered',
      text: (event) => `${event.registeredCount}/${event.capacity}`,
      sortValue: (event) => event.registeredCount,
    },
    { key: 'status', label: 'Status', text: (event) => stateOf(event).label },
    { key: 'actions', label: 'Actions', hideLabel: true },
  ],
  { initialSort: { key: 'when', dir: 'asc' } },
)
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

    <template v-else>
      <ChartPanel
        class="mb-4"
        title="Registrations for your upcoming events"
        :summary="barSummary"
        :columns="[
          { key: 'title', label: 'Event' },
          { key: 'registered', label: 'Registered' },
          { key: 'placesLeft', label: 'Places left' },
          { key: 'capacity', label: 'Capacity' },
          { key: 'fill', label: 'Full' },
        ]"
        :rows="barRows"
        :empty="!bars.length"
        empty-text="No upcoming events to chart. Past and cancelled events are left out."
        :height="barHeight"
      >
        <template #default="{ describedBy }">
          <Bar
            :data="barChart"
            :options="barChartOptions"
            aria-label="Stacked bar chart: registrations and places left for each upcoming event"
            :aria-describedby="describedBy"
          />
        </template>
      </ChartPanel>

      <TableExport class="mb-3" :table="table" name="my events" title="EcoStride - my events" />
      <DataTable :table="table" caption="Your events">
        <template #cell-title="{ row }">
          <span class="fw-semibold">{{ row.title }}</span>
        </template>
        <template #cell-status="{ row }">
          <span class="badge" :class="stateOf(row).class">{{ stateOf(row).label }}</span>
        </template>
        <template #cell-actions="{ row }">
          <div class="d-flex gap-2 justify-content-end">
            <RouterLink
              class="btn btn-outline-secondary btn-sm text-nowrap"
              :to="{ name: 'event-roster', params: { id: row.id } }"
            >
              Roster<span class="visually-hidden"> for {{ row.title }}</span>
            </RouterLink>
            <RouterLink
              v-if="row.status !== 'cancelled'"
              class="btn btn-outline-success btn-sm text-nowrap"
              :to="{ name: 'event-edit', params: { id: row.id } }"
            >
              Edit or cancel<span class="visually-hidden"> {{ row.title }}</span>
            </RouterLink>
          </div>
        </template>
      </DataTable>
    </template>
  </div>
</template>
