<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import travelImage from '../assets/card-travel.svg'
import { useJsonData } from '../composables/useJsonData'
import { user } from '../auth/authState'
import { geoDirections, geoSearch } from '../api/client'
import { validatePostcode, validateSuburb } from '../utils/validation'
import { distanceKm, formatDistance, formatDuration, profileForMode } from '../utils/geo'
import RouteMap from '../components/RouteMap.vue'

const { data, loading, error } = useJsonData('activeTravel')

const NEARBY_KM = 10

const suburb = ref('')
const postcode = ref('')
const travelMode = ref('Cycle')
const showErrors = ref(false)

// Where distances are measured from: a searched place or the user's location.
const origin = ref(null)
const searching = ref(false)
const locating = ref(false)
const searchMessage = ref('')
const selectedId = ref('')
const announcement = ref('')

const filters = computed(() => data.value?.filters ?? [])
const allRoutes = computed(() => data.value?.routes ?? [])

const suburbError = computed(() => validateSuburb(suburb.value))
const postcodeError = computed(() => validatePostcode(postcode.value))
const isFormValid = computed(() => !suburbError.value && !postcodeError.value)

// Routes for the chosen mode. With an origin: only those within 10 km,
// nearest first. Without one: all of them, by name.
const results = computed(() => {
  const forMode = allRoutes.value.filter((route) => route.modes.includes(travelMode.value))
  if (!origin.value) {
    return [...forMode].sort((a, b) => a.name.localeCompare(b.name))
  }
  return forMode
    .map((route) => ({ ...route, distanceKm: distanceKm(origin.value, route.start) }))
    .filter((route) => route.distanceKm <= NEARBY_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
})

// Trail shapes follow real paths (from the directions service) once loaded;
// until then, or if that fails, a dashed straight line from start to end.
const trailLines = reactive({})
const trailNote = ref('')

const mapRoutes = computed(() =>
  results.value.map((route) => ({
    id: route.id,
    name: route.name,
    start: route.start,
    line: route.end
      ? (trailLines[route.id] ?? [
          [route.start.lat, route.start.lng],
          [route.end.lat, route.end.lng],
        ])
      : null,
    approximate: Boolean(route.end && !trailLines[route.id]),
  })),
)

const TRAIL_CACHE_KEY = 'ecostride.trails.v1'

function readTrailCache() {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL_CACHE_KEY)) ?? {}
  } catch {
    return {}
  }
}

async function loadTrailLines() {
  const cached = readTrailCache()
  let failed = false
  // One at a time: a handful of small requests, gentle on the free quota.
  for (const route of allRoutes.value) {
    if (!route.end || trailLines[route.id]) continue
    if (cached[route.id]) {
      trailLines[route.id] = cached[route.id]
      continue
    }
    try {
      const { coordinates } = await geoDirections({ from: route.start, to: route.end, profile: 'cycling-regular' })
      trailLines[route.id] = coordinates
      cached[route.id] = coordinates
    } catch {
      failed = true
    }
  }
  try {
    sessionStorage.setItem(TRAIL_CACHE_KEY, JSON.stringify(cached))
  } catch {
    // Storage full or blocked: the shapes just get fetched again next visit.
  }
  trailNote.value = failed ? "Some trail shapes couldn't be loaded, so they're shown as dashed straight lines." : ''
}

watch(
  [user, allRoutes],
  ([signedIn, routes]) => {
    if (signedIn && routes.length) loadTrailLines()
  },
  { immediate: true },
)

async function onSearch() {
  showErrors.value = true
  searchMessage.value = ''
  if (!isFormValid.value) return

  searching.value = true
  try {
    const { places } = await geoSearch(`${suburb.value.trim()} ${postcode.value.trim()}`)
    if (!places.length) {
      searchMessage.value = `We couldn't find ${suburb.value.trim()} ${postcode.value.trim()} in Victoria. Check the spelling and postcode.`
      return
    }
    const [place] = places
    setOrigin({ lat: place.lat, lng: place.lng, label: `${suburb.value.trim()} ${postcode.value.trim()}` })
  } catch (searchError) {
    searchMessage.value = searchError.message
  } finally {
    searching.value = false
  }
}

const GEOLOCATION_ERRORS = {
  1: "Location access is turned off for this site. You can allow it in your browser's settings, or type a suburb and postcode instead.",
  2: "Your location isn't available right now. Type a suburb and postcode instead.",
  3: 'Finding your location took too long. Try again, or type a suburb and postcode instead.',
}

function useMyLocation() {
  searchMessage.value = ''
  if (!('geolocation' in navigator)) {
    searchMessage.value = "Your browser can't share your location. Type a suburb and postcode instead."
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating.value = false
      setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude, label: 'Your location' })
    },
    (geoError) => {
      locating.value = false
      searchMessage.value = GEOLOCATION_ERRORS[geoError.code] ?? GEOLOCATION_ERRORS[2]
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
  )
}

function setOrigin(place) {
  origin.value = place
  selectedId.value = ''
  const count = results.value.length
  announcement.value = count
    ? `${count} route${count === 1 ? '' : 's'} within ${NEARBY_KM} km of ${place.label}, nearest first.`
    : `No ${travelMode.value.toLowerCase()} routes within ${NEARBY_KM} km of ${place.label}.`
}

function clearOrigin() {
  origin.value = null
  announcement.value = 'Showing all routes.'
}

// Directions from the origin to a route's start, for the chosen travel mode.
const trip = ref(null)
const tripLoading = ref(false)
const tripSlow = ref(false)
const tripError = ref('')
const tripHeading = ref(null)
const suburbInput = ref(null)

function clearTrip() {
  trip.value = null
  tripError.value = ''
}

// A new mode or start point makes existing directions wrong.
watch([travelMode, origin], () => {
  if (trip.value) {
    clearTrip()
    announcement.value = 'Directions cleared because the travel mode or start point changed.'
  }
})

function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(Object.assign(new Error('unsupported'), { code: 2 }))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 5 * 60 * 1000,
    })
  })
}

async function getDirections(route) {
  tripError.value = ''
  selectRoute(route.id)
  if (!user.value) {
    tripError.value = 'Sign in to get directions.'
    return
  }

  tripLoading.value = true
  tripSlow.value = false
  const slowTimer = setTimeout(() => {
    tripSlow.value = true
  }, 5000)
  try {
    // Start from the searched place or known location; otherwise ask for the
    // user's location, and if that isn't possible, ask them to type a place.
    if (!origin.value) {
      try {
        const position = await currentPosition()
        origin.value = { lat: position.coords.latitude, lng: position.coords.longitude, label: 'Your location' }
      } catch (geoError) {
        tripError.value =
          (GEOLOCATION_ERRORS[geoError.code] ?? GEOLOCATION_ERRORS[2]) +
          ' Directions will start from the suburb you search for.'
        suburbInput.value?.focus()
        return
      }
    }
    const mode = travelMode.value
    const from = origin.value
    const result = await geoDirections({ from, to: route.start, profile: profileForMode(mode) })
    trip.value = { ...result, routeName: route.name, fromLabel: from.label, mode }
    announcement.value = ''
    await nextTick()
    tripHeading.value?.focus()
  } catch (directionsError) {
    tripError.value = directionsError.message
  } finally {
    clearTimeout(slowTimer)
    tripLoading.value = false
    tripSlow.value = false
  }
}

// Selecting from the list highlights and centres the marker; selecting a
// marker highlights the card and brings it into view.
async function selectRoute(id, { fromMap = false } = {}) {
  selectedId.value = id
  const route = allRoutes.value.find((r) => r.id === id)
  announcement.value = route ? `Selected ${route.name}.` : ''
  if (fromMap) {
    await nextTick()
    document.getElementById(`route-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}
</script>

<template>
  <div>
    <section class="hero-section border-bottom">
      <div class="container py-4 py-lg-5">
        <h1 class="h2 fw-bold mb-2">Find safe routes</h1>
        <p class="text-muted mb-4">
          Search a suburb or use your location to find walking and cycling routes within {{ NEARBY_KM }} km.
        </p>

        <form class="row g-3 align-items-start" novalidate @submit.prevent="onSearch">
          <div class="col-12">
            <p class="form-label mb-0">Suburb / postcode</p>
          </div>

          <div class="col-12 col-md-4 search-field">
            <label class="form-label" for="suburb">Suburb</label>
            <input
              id="suburb"
              ref="suburbInput"
              v-model="suburb"
              class="form-control"
              :class="{ 'is-invalid': showErrors && suburbError }"
              type="text"
              placeholder="e.g. Footscray"
              autocomplete="address-level2"
              :aria-invalid="showErrors && suburbError ? 'true' : undefined"
              :aria-describedby="showErrors && suburbError ? 'suburb-error' : undefined"
            />
            <div class="search-feedback">
              <div v-if="showErrors && suburbError" id="suburb-error" class="invalid-feedback d-block">
                {{ suburbError }}
              </div>
            </div>
          </div>

          <div class="col-12 col-sm-6 col-md-3 search-field">
            <label class="form-label" for="postcode">Postcode</label>
            <input
              id="postcode"
              v-model="postcode"
              class="form-control"
              :class="{ 'is-invalid': showErrors && postcodeError }"
              type="text"
              inputmode="numeric"
              maxlength="4"
              placeholder="e.g. 3011"
              autocomplete="postal-code"
              :aria-invalid="showErrors && postcodeError ? 'true' : undefined"
              :aria-describedby="showErrors && postcodeError ? 'postcode-error' : undefined"
            />
            <div class="search-feedback">
              <div v-if="showErrors && postcodeError" id="postcode-error" class="invalid-feedback d-block">
                {{ postcodeError }}
              </div>
            </div>
          </div>

          <div class="col-12 col-sm-6 col-md-3 search-field">
            <label class="form-label" for="travelMode">Travel mode</label>
            <select id="travelMode" v-model="travelMode" class="form-select">
              <option>Walk</option>
              <option>Cycle</option>
              <option>Micro-mobility</option>
            </select>
            <div class="search-feedback" aria-hidden="true"></div>
          </div>

          <div class="col-12 col-md-2 search-field">
            <label class="form-label d-none d-md-block" aria-hidden="true">&nbsp;</label>
            <button class="btn btn-success w-100" type="submit" :disabled="searching || !user">
              {{ searching ? 'Searching...' : 'Search' }}
            </button>
            <div class="search-feedback d-none d-md-block" aria-hidden="true"></div>
          </div>
        </form>

        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
          <button class="btn btn-outline-success btn-sm" type="button" :disabled="locating" @click="useMyLocation">
            {{ locating ? 'Finding your location...' : 'Use my location' }}
          </button>
          <button v-if="origin" class="btn btn-link btn-sm" type="button" @click="clearOrigin">Show all routes</button>
          <span v-if="!user" class="small text-muted">
            <RouterLink :to="{ name: 'FireLogin', query: { redirect: '/active-travel' } }">Sign in</RouterLink>
            to search by suburb and see each trail's exact path.
          </span>
        </div>
        <p v-if="searchMessage" class="small text-danger mt-2 mb-0" role="alert">{{ searchMessage }}</p>

        <div class="d-flex flex-wrap gap-2 mt-3">
          <span v-for="filter in filters" :key="filter" class="badge rounded-pill filter-chip">
            {{ filter }}
          </span>
        </div>
      </div>
    </section>

    <section class="py-4 py-lg-5">
      <div class="container">
        <p class="visually-hidden" aria-live="polite">{{ announcement }}</p>
        <div class="row g-4">
          <div class="col-12 col-lg-7">
            <RouteMap
              :routes="mapRoutes"
              :selected-id="selectedId"
              :origin="origin"
              label="Map of walking and cycling routes. Route markers can be selected with Enter."
              :directions-line="trip?.coordinates ?? null"
              @select="(id) => selectRoute(id, { fromMap: true })"
            />
            <p v-if="trailNote" class="small text-muted mt-2 mb-0">{{ trailNote }}</p>

            <p v-if="tripLoading" class="small text-muted mt-3 mb-0" role="status">
              {{ tripSlow ? 'Still getting directions - the directions service is slow right now...' : 'Getting directions...' }}
            </p>
            <p v-if="tripError" class="small text-danger mt-3 mb-0" role="alert">{{ tripError }}</p>

            <section v-if="trip" class="border rounded-3 p-3 mt-3" aria-labelledby="trip-heading">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <h2 id="trip-heading" ref="tripHeading" class="h5 fw-bold mb-1" tabindex="-1">
                  Directions to {{ trip.routeName }}
                </h2>
                <button class="btn btn-sm btn-outline-secondary" type="button" @click="clearTrip">
                  Clear<span class="visually-hidden"> directions</span>
                </button>
              </div>
              <p class="small text-muted mb-2">
                {{ trip.mode === 'Walk' ? 'Walking' : 'Cycling' }} from {{ trip.fromLabel }} to the start of the route.
              </p>
              <p class="mb-2">
                <strong>{{ formatDistance(trip.distance) }}</strong>, about
                <strong>{{ formatDuration(trip.duration) }}</strong>
              </p>
              <p v-if="trip.mode === 'Micro-mobility'" class="small alert alert-info py-2 mb-2">
                Scooters and other micro-mobility use cycling directions, so the time is an estimate for a bicycle.
              </p>
              <ol class="small mb-0 ps-3">
                <li v-for="(step, index) in trip.steps" :key="index" class="mb-1">
                  {{ step.instruction }}
                  <span v-if="step.distance" class="text-muted">({{ formatDistance(step.distance) }})</span>
                </li>
              </ol>
            </section>
          </div>

          <div class="col-12 col-lg-5">
            <h2 class="h4 fw-bold mb-1">Results</h2>
            <p class="small text-muted">
              <template v-if="origin">
                {{ travelMode }} routes within {{ NEARBY_KM }} km of {{ origin.label }}, nearest first.
              </template>
              <template v-else>All {{ travelMode.toLowerCase() }} routes. Search or use your location to sort by distance.</template>
            </p>

            <p v-if="loading" class="text-muted">Loading route data...</p>
            <p v-else-if="error" class="text-danger">{{ error }}</p>

            <p v-else-if="!results.length" class="text-muted">
              No {{ travelMode.toLowerCase() }} routes within {{ NEARBY_KM }} km. Try another travel mode or place.
            </p>

            <div v-else class="d-flex flex-column gap-3">
              <article
                v-for="route in results"
                :id="`route-${route.id}`"
                :key="route.id"
                class="card shadow-sm"
                :class="{ 'border-primary border-2': route.id === selectedId }"
              >
                <div class="row g-0 align-items-center">
                  <div class="col-4 col-sm-3">
                    <img class="img-fluid rounded-start route-thumb" :src="travelImage" alt="" />
                  </div>
                  <div class="col-8 col-sm-9">
                    <div class="card-body py-3">
                      <h3 class="h6 fw-bold mb-1">{{ route.name }}</h3>
                      <p class="small text-muted mb-2">
                        {{ route.detail }}
                        <template v-if="route.distanceKm !== undefined">
                          · {{ route.distanceKm.toFixed(1) }} km away
                        </template>
                      </p>
                      <div class="d-flex flex-wrap gap-2">
                        <button
                          class="btn btn-success btn-sm"
                          type="button"
                          :disabled="tripLoading"
                          @click="getDirections(route)"
                        >
                          Directions<span class="visually-hidden"> to {{ route.name }}</span>
                        </button>
                        <button
                          class="btn btn-outline-success btn-sm"
                          type="button"
                          :aria-pressed="route.id === selectedId ? 'true' : 'false'"
                          @click="selectRoute(route.id)"
                        >
                          Show on map<span class="visually-hidden">: {{ route.name }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
