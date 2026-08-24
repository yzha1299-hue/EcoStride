<script setup>
import { computed, ref } from 'vue'
import mapImage from '../assets/map-routes.svg'
import travelImage from '../assets/card-travel.svg'
import { validatePostcode, validateSuburb } from '../utils/validation'

const suburb = ref('')
const postcode = ref('')
const travelMode = ref('Cycle')
const showErrors = ref(false)
const hasSearched = ref(false)

const filters = ['Well-lit paths', 'Safe corridors', 'Bike parking', 'Accessible']

const allRoutes = [
  {
    name: 'Maribyrnong River Trail',
    detail: 'Lit path · ~2.4 km · parking nearby',
    suburb: 'Footscray',
    postcode: '3011',
    modes: ['Walk', 'Cycle'],
  },
  {
    name: 'Capital City Trail',
    detail: 'Shared path · ~3.1 km · quiet streets',
    suburb: 'Carlton',
    postcode: '3053',
    modes: ['Walk', 'Cycle'],
  },
  {
    name: 'Main Yarra Trail',
    detail: 'Riverside corridor · ~4.0 km · well-lit',
    suburb: 'Richmond',
    postcode: '3121',
    modes: ['Walk', 'Cycle', 'Micro-mobility'],
  },
  {
    name: 'Beach Road Bike Path',
    detail: 'Coastal path · ~5.2 km · accessible',
    suburb: 'St Kilda',
    postcode: '3182',
    modes: ['Cycle', 'Micro-mobility'],
  },
  {
    name: 'Southern Cross Bike Hub',
    detail: 'Secure racks · near station',
    suburb: 'Docklands',
    postcode: '3008',
    modes: ['Cycle', 'Micro-mobility'],
  },
]

const suburbError = computed(() => validateSuburb(suburb.value))
const postcodeError = computed(() => validatePostcode(postcode.value))
const isFormValid = computed(() => !suburbError.value && !postcodeError.value)

const results = computed(() => {
  if (!hasSearched.value) {
    return []
  }

  const suburbQuery = suburb.value.trim().toLowerCase()
  const postcodeQuery = postcode.value.trim()

  return allRoutes.filter((route) => {
    const matchesPlace =
      route.suburb.toLowerCase() === suburbQuery || route.postcode === postcodeQuery
    const matchesMode = route.modes.includes(travelMode.value)
    return matchesPlace && matchesMode
  })
})

function onSearch() {
  showErrors.value = true
  hasSearched.value = isFormValid.value
}
</script>

<template>
  <div>
    <section class="hero-section border-bottom">
      <div class="container py-4 py-lg-5">
        <h1 class="h2 fw-bold mb-2">Find safe routes</h1>
        <p class="text-muted mb-4">
          Search suburbs for cycling corridors, lit paths, and bike parking.
        </p>

        <form class="row g-3 align-items-start" novalidate @submit.prevent="onSearch">
          <div class="col-12">
            <p class="form-label mb-0">Suburb / postcode</p>
          </div>

          <div class="col-12 col-md-4 search-field">
            <label class="form-label" for="suburb">Suburb</label>
            <input
              id="suburb"
              v-model="suburb"
              class="form-control"
              :class="{ 'is-invalid': showErrors && suburbError }"
              type="text"
              placeholder="e.g. Footscray"
              autocomplete="address-level2"
            />
            <div class="search-feedback">
              <div v-if="showErrors && suburbError" class="invalid-feedback d-block">
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
            />
            <div class="search-feedback">
              <div v-if="showErrors && postcodeError" class="invalid-feedback d-block">
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
            <label class="form-label d-none d-md-block">&nbsp;</label>
            <button class="btn btn-success w-100" type="submit">Search</button>
            <div class="search-feedback d-none d-md-block" aria-hidden="true"></div>
          </div>
        </form>

        <div class="d-flex flex-wrap gap-2 mt-3">
          <span v-for="filter in filters" :key="filter" class="badge rounded-pill filter-chip">
            {{ filter }}
          </span>
        </div>
      </div>
    </section>

    <section class="py-4 py-lg-5">
      <div class="container">
        <div class="row g-4">
          <div class="col-12 col-lg-7">
            <img
              class="img-fluid w-100 rounded-4 map-panel"
              :src="mapImage"
              alt="Map of safe walking and cycling routes"
            />
          </div>

          <div class="col-12 col-lg-5">
            <h2 class="h4 fw-bold mb-3">Results</h2>

            <p v-if="!hasSearched" class="text-muted">
              Enter a suburb and 4-digit postcode to see nearby routes.
            </p>

            <p v-else-if="!results.length" class="text-muted">
              No matching routes for this suburb, postcode, and travel mode.
            </p>

            <div v-else class="d-flex flex-column gap-3">
              <article v-for="route in results" :key="route.name" class="card shadow-sm">
                <div class="row g-0 align-items-center">
                  <div class="col-4 col-sm-3">
                    <img
                      class="img-fluid rounded-start route-thumb"
                      :src="travelImage"
                      :alt="route.name"
                    />
                  </div>
                  <div class="col-8 col-sm-9">
                    <div class="card-body py-3">
                      <h3 class="h6 fw-bold mb-1">{{ route.name }}</h3>
                      <p class="small text-muted mb-2">{{ route.detail }}</p>
                      <a class="btn btn-outline-success btn-sm" href="#">View</a>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <a class="btn btn-outline-success mt-3" href="#">+ Report a route</a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
