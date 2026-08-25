<script setup>
import { computed } from 'vue'
import heroImage from '../assets/hero-active-travel.svg'
import travelImage from '../assets/card-travel.svg'
import clubsImage from '../assets/card-clubs.svg'
import eventsImage from '../assets/card-events.svg'
import { useJsonData } from '../composables/useJsonData'
import { formatNumber } from '../utils/format'

const { data, loading, error } = useJsonData('/data/impact.json')
const stats = computed(() => data.value?.communityTotals ?? [])

const experiences = [
  {
    title: 'Active Travel',
    description: 'Find safe walking and cycling routes.',
    action: 'Open',
    image: travelImage,
    to: '/active-travel',
  },
  {
    title: 'Club Sustainability',
    description: 'Help clubs cut energy and travel emissions.',
    action: 'Open',
    image: clubsImage,
    to: '/clubs',
  },
  {
    title: 'Events & Workshops',
    description: 'Register for community green sessions.',
    action: 'Open',
    image: eventsImage,
    to: '/events',
  },
]

const guides = [
  {
    title: 'For participants',
    description: 'Families, youth, casual commuters — how to find routes and join events.',
  },
  {
    title: 'For club admins',
    description: 'Run audits, carpools, and gear sharing with low-barrier tools.',
  },
]
</script>

<template>
  <div>
    <section class="hero-section">
      <div class="container py-5">
        <div class="row g-4 align-items-center">
          <div class="col-12 col-lg-6">
            <p class="text-uppercase small fw-semibold text-success mb-2">
              Climate action through sport
            </p>
            <h1 class="display-5 fw-bold mb-3">Move greener across Melbourne</h1>
            <p class="lead text-muted mb-4">
              EcoStride helps communities take climate action through sport and active travel —
              safer routes, greener clubs, and local events.
            </p>
            <div class="d-flex flex-wrap gap-2">
              <RouterLink class="btn btn-success" to="/active-travel">Find Safe Routes</RouterLink>
              <RouterLink class="btn btn-outline-success" to="/events">Join an Event</RouterLink>
              <RouterLink class="btn btn-light border" to="/clubs">Club Tools</RouterLink>
            </div>
          </div>
          <div class="col-12 col-lg-6">
            <img
              class="img-fluid w-100 rounded-4 hero-image"
              :src="heroImage"
              alt="People cycling on a green Melbourne path"
            />
          </div>
        </div>
      </div>
    </section>

    <section class="py-5">
      <div class="container">
        <h2 class="h3 fw-bold mb-4">Core experiences</h2>
        <div class="row g-3">
          <div v-for="item in experiences" :key="item.title" class="col-12 col-md-6 col-lg-4">
            <article class="card h-100 shadow-sm">
              <img class="card-img-top img-fluid" :src="item.image" :alt="item.title" />
              <div class="card-body d-flex flex-column">
                <h3 class="h5 fw-bold">{{ item.title }}</h3>
                <p class="text-muted flex-grow-1">{{ item.description }}</p>
                <RouterLink
                  v-if="item.to"
                  class="btn btn-outline-success btn-sm align-self-start"
                  :to="item.to"
                >
                  {{ item.action }}
                </RouterLink>
                <a v-else class="btn btn-outline-success btn-sm align-self-start" href="#">
                  {{ item.action }}
                </a>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>

    <section class="py-5 bg-light">
      <div class="container">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <h2 class="h3 fw-bold mb-0">Impact snapshot</h2>
          <RouterLink class="btn btn-outline-success btn-sm" to="/impact">View impact</RouterLink>
        </div>
        <p v-if="loading" class="text-muted mb-0">Loading impact data…</p>
        <p v-else-if="error" class="text-danger mb-0">{{ error }}</p>
        <div v-else class="row g-3">
          <div v-for="stat in stats" :key="stat.key" class="col-6 col-lg-3">
            <div class="stat-card text-center p-4 h-100">
              <div class="display-6 fw-bold text-success">{{ formatNumber(stat.value) }}</div>
              <div class="text-muted">{{ stat.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="py-5">
      <div class="container">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
          <h2 class="h3 fw-bold mb-0">Getting started</h2>
          <a class="btn btn-outline-success btn-sm" href="#">View guides</a>
        </div>
        <div class="row g-3">
          <div v-for="guide in guides" :key="guide.title" class="col-12 col-md-6">
            <article class="card h-100">
              <div class="card-body">
                <h3 class="h5 fw-bold">{{ guide.title }}</h3>
                <p class="text-muted mb-0">{{ guide.description }}</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
