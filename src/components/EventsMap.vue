<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { geoSearch } from '../api/client'
import { currentPosition, GEOLOCATION_ERRORS, useDirections } from '../composables/useDirections'
import { formatLongDate, formatTimeRange } from '../utils/format'
import { EVENT_STATE, eventState, placesLeft } from '../../shared/eventState'
import RouteMap from './RouteMap.vue'
import TripDirections from './TripDirections.vue'

// Map view of the Events page: a marker per venue, details of the selected
// event, and walking/cycling directions to it from the user's location or a
// typed place (the same directions feature as Active Travel).
const props = defineProps({
  // Events already filtered by the page's search and toggles.
  events: { type: Array, required: true },
})

const hasLocation = (event) => typeof event.lat === 'number' && typeof event.lng === 'number'
const located = computed(() => props.events.filter(hasLocation))
const unlocated = computed(() => props.events.filter((event) => !hasLocation(event)))

const mapMarkers = computed(() =>
  located.value.map((event) => ({ id: event.id, name: event.title, start: { lat: event.lat, lng: event.lng }, line: null })),
)

const selectedId = ref('')
const selected = computed(() => located.value.find((event) => event.id === selectedId.value) ?? null)
const detailsHeading = ref(null)

async function select(id) {
  selectedId.value = id
  await nextTick()
  detailsHeading.value?.focus()
}

const STATE_TEXT = {
  [EVENT_STATE.OPEN]: 'Open for registration',
  [EVENT_STATE.FULL]: 'Full',
  [EVENT_STATE.CLOSED]: 'Registration closed',
  [EVENT_STATE.CANCELLED]: 'Cancelled',
}

// Where directions start: the user's location or a place they type.
const start = ref(null)
const startQuery = ref('')
const startMessage = ref('')
const findingStart = ref(false)
const startInput = ref(null)
const mode = ref('Walk')

async function useMyLocation() {
  startMessage.value = ''
  findingStart.value = true
  try {
    start.value = await currentPosition()
  } catch (geoError) {
    startMessage.value = GEOLOCATION_ERRORS[geoError.code] ?? GEOLOCATION_ERRORS[2]
    startInput.value?.focus()
  } finally {
    findingStart.value = false
  }
}

async function findStart() {
  const query = startQuery.value.trim()
  startMessage.value = ''
  if (!query) {
    startMessage.value = 'Type a suburb, postcode or address to start from.'
    startInput.value?.focus()
    return
  }
  findingStart.value = true
  try {
    const { places } = await geoSearch(query)
    if (!places.length) {
      startMessage.value = `We couldn't find "${query}" in Victoria. Try adding the suburb or postcode.`
      return
    }
    start.value = { lat: places[0].lat, lng: places[0].lng, label: query }
  } catch (searchError) {
    startMessage.value = searchError.message
  } finally {
    findingStart.value = false
  }
}

const directions = useDirections()
const tripPanel = ref(null)

// Directions only make sense for the current event, start and mode.
watch([selectedId, start, mode], () => directions.clear())

async function getDirections() {
  if (!start.value) {
    startMessage.value = 'Choose where you are starting from first: use your location or type a place.'
    startInput.value?.focus()
    return
  }
  const event = selected.value
  const loaded = await directions.load({
    from: start.value,
    to: { lat: event.lat, lng: event.lng, label: event.title },
    mode: mode.value,
    toDescription: `the venue, ${event.venue}`,
  })
  if (loaded) {
    await nextTick()
    tripPanel.value?.focus()
  }
}
</script>

<template>
  <div class="row g-4">
    <div class="col-12 col-lg-7">
      <RouteMap
        :routes="mapMarkers"
        :selected-id="selectedId"
        :origin="start"
        :directions-line="directions.trip.value?.coordinates ?? null"
        label="Map of event venues. Venue markers can be selected with Enter."
        marker-prefix="Venue of"
        @select="select"
      />
      <div v-if="unlocated.length" class="small text-muted mt-2">
        <p class="mb-1">
          {{ unlocated.length }} event{{ unlocated.length === 1 ? " isn't" : "s aren't" }} on the map because
          {{ unlocated.length === 1 ? 'its organiser hasn\'t' : "their organisers haven't" }} set a map location yet.
          {{ unlocated.length === 1 ? 'It is' : 'They are' }} still in the list view:
        </p>
        <ul class="mb-0">
          <li v-for="event in unlocated" :key="event.id">{{ event.title }} ({{ event.venue }})</li>
        </ul>
      </div>
    </div>

    <div class="col-12 col-lg-5">
      <p v-if="!located.length" class="text-muted">None of the events matching your filters have a map location.</p>
      <p v-else-if="!selected" class="text-muted">
        Select a venue marker to see the event and get directions. {{ located.length }}
        event{{ located.length === 1 ? ' is' : 's are' }} on the map.
      </p>

      <template v-else>
        <h2 ref="detailsHeading" class="h5 fw-bold mb-1" tabindex="-1">{{ selected.title }}</h2>
        <p class="small mb-1">{{ formatLongDate(selected.startsAt) }}, {{ formatTimeRange(selected.startsAt, selected.endsAt) }}</p>
        <p class="small mb-1">{{ selected.venue }}, {{ selected.address }}</p>
        <p class="small text-muted mb-3">
          {{ STATE_TEXT[eventState(selected)] }}<template v-if="eventState(selected) === EVENT_STATE.OPEN">
            · {{ placesLeft(selected) }} of {{ selected.capacity }} places left</template>. Register from the list view.
        </p>

        <fieldset class="border rounded-3 p-3 mb-3">
          <legend class="small fw-semibold float-none w-auto px-1 mb-1">Directions to this event</legend>
          <div class="mb-2">
            <label class="form-label small mb-1" for="directions-start">Start from</label>
            <div class="input-group input-group-sm">
              <input
                id="directions-start"
                ref="startInput"
                v-model="startQuery"
                class="form-control"
                type="text"
                placeholder="Suburb, postcode or address"
                autocomplete="street-address"
                @keydown.enter.prevent="findStart"
              />
              <button class="btn btn-outline-secondary" type="button" :disabled="findingStart" @click="findStart">Set</button>
            </div>
            <button class="btn btn-link btn-sm px-0" type="button" :disabled="findingStart" @click="useMyLocation">
              Use my location instead
            </button>
            <p class="small mb-0" role="status">
              <span v-if="startMessage" class="text-danger">{{ startMessage }}</span>
              <span v-else-if="start" class="text-muted">Starting from {{ start.label }}.</span>
            </p>
          </div>
          <div class="d-flex flex-wrap align-items-end gap-2">
            <div>
              <label class="form-label small mb-1" for="directions-mode">Travel by</label>
              <select id="directions-mode" v-model="mode" class="form-select form-select-sm">
                <option>Walk</option>
                <option>Cycle</option>
                <option>Micro-mobility</option>
              </select>
            </div>
            <button class="btn btn-success btn-sm" type="button" :disabled="directions.loading.value" @click="getDirections">
              {{ directions.loading.value ? 'Getting directions...' : 'Get directions' }}
            </button>
          </div>
          <p v-if="directions.slow.value" class="small text-muted mt-2 mb-0" role="status">
            Still getting directions - the directions service is slow right now...
          </p>
          <p v-if="directions.error.value" class="small text-danger mt-2 mb-0" role="alert">{{ directions.error.value }}</p>
        </fieldset>

        <TripDirections v-if="directions.trip.value" ref="tripPanel" :trip="directions.trip.value" @clear="directions.clear()" />
      </template>
    </div>
  </div>
</template>
