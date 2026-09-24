<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import travelImage from '../assets/card-travel.svg'
import { useJsonData } from '../composables/useJsonData'
import { user } from '../auth/authState'
import { geoDirections, geoNearby, geoSearch } from '../api/client'
import { currentPosition, GEOLOCATION_ERRORS, useDirections } from '../composables/useDirections'
import { validatePostcode, validateSuburb } from '../utils/validation'
import { AMENITY_STYLES, distanceKm, formatDistance } from '../utils/geo'
import RouteMap from '../components/RouteMap.vue'
import TripDirections from '../components/TripDirections.vue'

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

function useMyLocation() {
  searchMessage.value = ''
  locating.value = true
  currentPosition()
    .then(setOrigin)
    .catch((geoError) => {
      searchMessage.value = GEOLOCATION_ERRORS[geoError.code] ?? GEOLOCATION_ERRORS[2]
    })
    .finally(() => {
      locating.value = false
    })
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
const directions = useDirections()
const tripPanel = ref(null)
const suburbInput = ref(null)
const tripError = ref('')

// A new mode or start point makes existing directions wrong.
watch([travelMode, origin], () => {
  if (directions.trip.value) {
    directions.clear()
    announcement.value = 'Directions cleared because the travel mode or start point changed.'
  }
})

async function getDirections(route) {
  tripError.value = ''
  directions.error.value = ''
  selectRoute(route.id)
  if (!user.value) {
    tripError.value = 'Sign in to get directions.'
    return
  }
  // Start from the searched place or known location; otherwise ask for the
  // user's location, and if that isn't possible, ask them to type a place.
  if (!origin.value) {
    try {
      origin.value = await currentPosition()
    } catch (geoError) {
      tripError.value =
        (GEOLOCATION_ERRORS[geoError.code] ?? GEOLOCATION_ERRORS[2]) +
        ' Directions will start from the suburb you search for.'
      suburbInput.value?.focus()
      return
    }
  }
  const loaded = await directions.load({
    from: origin.value,
    to: { ...route.start, label: route.name },
    mode: travelMode.value,
    toDescription: 'the start of the route',
  })
  if (loaded) {
    announcement.value = ''
    await nextTick()
    tripPanel.value?.focus()
  }
}

// Nearby facilities for the selected route, fetched once per route (all three
// types together) and filtered by the toggles.
const shownAmenities = reactive({ bikeParking: false, drinkingWater: false, toilets: false })
const nearbyByRoute = reactive({})
const nearbyLoading = ref(false)
const nearbyError = ref('')

const selectedRoute = computed(() => allRoutes.value.find((route) => route.id === selectedId.value) ?? null)
const anyAmenityShown = computed(() => Object.values(shownAmenities).some(Boolean))

// Kept for the browser session: facilities rarely change, and the public
// Overpass service is slow and rations requests.
const NEARBY_CACHE_KEY = 'ecostride.nearby.v1'

function readNearbyCache() {
  try {
    return JSON.parse(sessionStorage.getItem(NEARBY_CACHE_KEY)) ?? {}
  } catch {
    return {}
  }
}

async function loadNearby() {
  const route = selectedRoute.value
  nearbyError.value = ''
  if (!route || !anyAmenityShown.value || !user.value || nearbyByRoute[route.id]) return
  const cache = readNearbyCache()
  const withDistance = (places) =>
    places.map((place) => ({ ...place, distanceKm: distanceKm(route.start, place) }))
  if (cache[route.id]) {
    nearbyByRoute[route.id] = withDistance(cache[route.id])
    return
  }
  nearbyLoading.value = true
  try {
    const { places } = await geoNearby({ start: route.start, end: route.end })
    nearbyByRoute[route.id] = withDistance(places)
    try {
      sessionStorage.setItem(NEARBY_CACHE_KEY, JSON.stringify({ ...cache, [route.id]: places }))
    } catch {
      // Storage full or blocked: it's just fetched again next time.
    }
  } catch (nearbyFailure) {
    nearbyError.value = nearbyFailure.message
  } finally {
    nearbyLoading.value = false
  }
}

watch([selectedId, anyAmenityShown, user], loadNearby)

function amenityLabel(place) {
  const type = AMENITY_STYLES[place.category].label
  const details = [
    place.capacity ? `${place.capacity} spaces` : null,
    place.wheelchair === 'yes' ? 'wheelchair accessible' : null,
    place.fee === 'yes' ? 'fee' : null,
  ].filter(Boolean)
  return `${type}: ${place.name ?? 'unnamed'}${details.length ? ` (${details.join(', ')})` : ''}`
}

// Per shown type: its places, nearest to the route start first.
const nearbyGroups = computed(() => {
  const places = nearbyByRoute[selectedId.value]
  if (!places) return []
  return Object.entries(AMENITY_STYLES)
    .filter(([category]) => shownAmenities[category])
    .map(([category, style]) => ({
      category,
      ...style,
      places: places.filter((place) => place.category === category).sort((a, b) => a.distanceKm - b.distanceKm),
    }))
})

const mapAmenities = computed(() =>
  nearbyGroups.value.flatMap((group) => group.places.map((place) => ({ ...place, label: amenityLabel(place) }))),
)

const NEARBY_LIST_LIMIT = 5

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

        <div class="mt-3" role="group" aria-labelledby="amenity-toggles-label">
          <p id="amenity-toggles-label" class="small fw-semibold mb-2">Show near the selected route (500 m)</p>
          <div class="d-flex flex-wrap gap-2">
            <button
              v-for="(style, category) in AMENITY_STYLES"
              :key="category"
              class="btn btn-sm rounded-pill amenity-toggle"
              :class="shownAmenities[category] ? 'btn-dark' : 'btn-outline-dark'"
              type="button"
              :aria-pressed="shownAmenities[category] ? 'true' : 'false'"
              @click="shownAmenities[category] = !shownAmenities[category]"
            >
              <span class="amenity-swatch" :style="{ background: style.color }" aria-hidden="true">{{ style.letter }}</span>
              {{ style.label }}
            </button>
          </div>
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
              :directions-line="directions.trip.value?.coordinates ?? null"
              :amenities="mapAmenities"
              @select="(id) => selectRoute(id, { fromMap: true })"
            />
            <p v-if="trailNote" class="small text-muted mt-2 mb-0">{{ trailNote }}</p>

            <section v-if="anyAmenityShown" class="mt-3" aria-labelledby="nearby-heading" aria-live="polite">
              <h2 id="nearby-heading" class="h6 fw-bold mb-2">
                Nearby{{ selectedRoute ? ` ${selectedRoute.name}` : '' }}
              </h2>
              <p v-if="!user" class="small text-muted mb-0">
                <RouterLink :to="{ name: 'FireLogin', query: { redirect: '/active-travel' } }">Sign in</RouterLink>
                to see bike parking, drinking water and toilets near a route.
              </p>
              <p v-else-if="!selectedRoute" class="small text-muted mb-0">
                Select a route (with "Show on map" or its marker) to see what's within 500 m of it.
              </p>
              <p v-else-if="nearbyLoading" class="small text-muted mb-0">
                Looking for nearby facilities... this can take up to 20 seconds.
              </p>
              <div v-else-if="nearbyError" class="d-flex flex-wrap align-items-center gap-2">
                <p class="small text-danger mb-0" role="alert">{{ nearbyError }}</p>
                <button class="btn btn-outline-secondary btn-sm" type="button" @click="loadNearby">Try again</button>
              </div>
              <div v-else-if="nearbyGroups.length" class="row g-3">
                <div v-for="group in nearbyGroups" :key="group.category" class="col-12 col-md-4">
                  <p class="small fw-semibold mb-1">
                    <span class="amenity-swatch" :style="{ background: group.color }" aria-hidden="true">{{ group.letter }}</span>
                    {{ group.label }}: {{ group.places.length }}
                  </p>
                  <p v-if="!group.places.length" class="small text-muted mb-0">
                    None found within 500 m of this route.
                  </p>
                  <ul v-else class="small list-unstyled mb-0">
                    <li v-for="place in group.places.slice(0, NEARBY_LIST_LIMIT)" :key="place.id">
                      {{ place.name ?? 'Unnamed' }}
                      <span class="text-muted">- {{ formatDistance(place.distanceKm * 1000) }} from the start</span>
                    </li>
                    <li v-if="group.places.length > NEARBY_LIST_LIMIT" class="text-muted">
                      and {{ group.places.length - NEARBY_LIST_LIMIT }} more on the map
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <p v-if="directions.loading.value" class="small text-muted mt-3 mb-0" role="status">
              {{
                directions.slow.value
                  ? 'Still getting directions - the directions service is slow right now...'
                  : 'Getting directions...'
              }}
            </p>
            <p v-if="tripError || directions.error.value" class="small text-danger mt-3 mb-0" role="alert">
              {{ tripError || directions.error.value }}
            </p>
            <TripDirections
              v-if="directions.trip.value"
              ref="tripPanel"
              class="mt-3"
              :trip="directions.trip.value"
              @clear="directions.clear()"
            />
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
                          :disabled="directions.loading.value"
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

<style scoped>
.amenity-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 4px;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  margin-right: 0.25rem;
}
</style>
