<script setup>
const experiences = [
  {
    title: 'Active Travel',
    description: 'Find safe walking and cycling routes.',
    action: 'Open',
  },
  {
    title: 'Club Sustainability',
    description: 'Help clubs cut energy and travel emissions.',
    action: 'Open',
  },
  {
    title: 'Events & Workshops',
    description: 'Register for community green sessions.',
    action: 'Open',
  },
]

const stats = [
  { value: '1,240', label: 'Route searches' },
  { value: '318', label: 'Event sign-ups' },
  { value: '86', label: 'Gear shares' },
  { value: '4,920', label: 'kg CO₂ saved' },
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
              <a class="btn btn-success" href="#">Find Safe Routes</a>
              <a class="btn btn-outline-success" href="#">Join an Event</a>
              <a class="btn btn-light border" href="#">Club Tools</a>
            </div>
          </div>
          <div class="col-12 col-lg-6">
            <div class="hero-visual d-flex align-items-center justify-content-center">
              <div class="text-center text-white px-3">
                <p class="h4 fw-semibold mb-1">Walk · Cycle · Share</p>
                <p class="mb-0 opacity-75">Hero image placeholder</p>
              </div>
            </div>
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
              <div class="card-body d-flex flex-column">
                <h3 class="h5 fw-bold">{{ item.title }}</h3>
                <p class="text-muted flex-grow-1">{{ item.description }}</p>
                <a class="btn btn-outline-success btn-sm align-self-start" href="#">
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
        <h2 class="h3 fw-bold mb-4">Impact snapshot</h2>
        <div class="row g-3">
          <div v-for="stat in stats" :key="stat.label" class="col-6 col-lg-3">
            <div class="stat-card text-center p-4 h-100">
              <div class="display-6 fw-bold text-success">{{ stat.value }}</div>
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
