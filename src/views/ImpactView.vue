<script setup>
import { computed } from 'vue'
import { useJsonData } from '../composables/useJsonData'
import { formatNumber } from '../utils/format'
import travelImage from '../assets/card-travel.svg'
import clubsImage from '../assets/card-clubs.svg'
import eventsImage from '../assets/card-events.svg'

const storyImages = {
  travel: travelImage,
  clubs: clubsImage,
  events: eventsImage,
}

const { data, loading, error } = useJsonData('/data/impact.json')

const communityTotals = computed(() => data.value?.communityTotals ?? [])
const personal = computed(() => data.value?.personal ?? null)
const stories = computed(() => data.value?.stories ?? [])

const personalStats = computed(() => {
  if (!personal.value) {
    return []
  }

  return [
    { label: 'Trips logged', value: personal.value.tripsLogged },
    { label: 'km active', value: personal.value.kmActive },
    { label: 'kg CO₂', value: personal.value.kgCo2 },
  ]
})
</script>

<template>
  <div>
    <section class="hero-section border-bottom">
      <div class="container py-4 py-lg-5">
        <h1 class="h2 fw-bold mb-2">Your impact</h1>
        <p class="text-muted mb-4">Track CO₂ savings and share stories.</p>

        <p v-if="loading" class="text-muted">Loading impact data…</p>
        <p v-else-if="error" class="text-danger">{{ error }}</p>

        <div v-else class="row g-4">
          <div class="col-12 col-lg-6">
            <div class="stat-card p-4 h-100">
              <p class="small text-uppercase text-muted fw-semibold mb-3">Personal CO₂ tracker</p>
              <div class="progress progress-track mb-4">
                <div
                  class="progress-bar bg-success"
                  role="progressbar"
                  :style="{ width: personal.progressPercent + '%' }"
                  :aria-valuenow="personal.progressPercent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {{ personal.progressPercent }}%
                </div>
              </div>
              <div class="row g-3 mb-4">
                <div v-for="stat in personalStats" :key="stat.label" class="col-4">
                  <div class="text-center">
                    <div class="h4 fw-bold text-success mb-1">{{ formatNumber(stat.value) }}</div>
                    <div class="small text-muted">{{ stat.label }}</div>
                  </div>
                </div>
              </div>
              <a class="btn btn-success" href="#">Log a trip</a>
            </div>
          </div>

          <div class="col-12 col-lg-6">
            <div class="stat-card p-4 h-100">
              <p class="small text-uppercase text-muted fw-semibold mb-3">
                Community totals (anonymised)
              </p>
              <div class="row g-3 mb-3">
                <div v-for="stat in communityTotals" :key="stat.key" class="col-6">
                  <div class="border rounded-3 p-3 h-100 text-center">
                    <div class="h4 fw-bold text-success mb-1">{{ formatNumber(stat.value) }}</div>
                    <div class="small text-muted">{{ stat.label }}</div>
                  </div>
                </div>
              </div>
              <p class="small text-muted mb-0">
                Shown to councils and donors as aggregate evidence — no personal data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-4 py-lg-5">
      <div class="container">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <h2 class="h4 fw-bold mb-0">Participant stories</h2>
          <a class="btn btn-outline-success btn-sm" href="#">Read all</a>
        </div>

        <div v-if="!loading && !error" class="row g-3">
          <div v-for="story in stories" :key="story.id" class="col-12 col-md-6 col-lg-4">
            <article class="card h-100 shadow-sm">
              <img
                class="card-img-top img-fluid story-photo"
                :src="storyImages[story.imageKey]"
                :alt="story.title"
              />
              <div class="card-body">
                <h3 class="h5 fw-bold">{{ story.title }}</h3>
                <p class="text-muted mb-0">{{ story.quote }}</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
