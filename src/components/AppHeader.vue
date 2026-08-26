<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Active Travel', to: '/active-travel' },
  { label: 'Clubs', to: '/clubs' },
  { label: 'Gear', to: '#' },
  { label: 'Events', to: '/events' },
  { label: 'Impact', to: '/impact' },
  { label: 'Help', to: '#' },
]

const headerAction = computed(() => {
  if (route.path === '/clubs') {
    return 'Club admin'
  }
  if (route.path === '/events') {
    return 'My registrations'
  }
  return 'Sign in'
})

function isCurrent(item) {
  return item.to !== '#' && route.path === item.to
}
</script>

<template>
  <header class="site-header">
    <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom">
      <div class="container">
        <RouterLink class="navbar-brand d-flex align-items-center gap-2" to="/">
          <span class="brand-mark" aria-hidden="true">ES</span>
          <span class="brand-text">EcoStride Melbourne</span>
        </RouterLink>

        <button
          class="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#primaryNav"
          aria-controls="primaryNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span class="navbar-toggler-icon"></span>
        </button>

        <div id="primaryNav" class="collapse navbar-collapse">
          <ul class="navbar-nav ms-auto me-lg-3 mb-2 mb-lg-0">
            <li v-for="item in navItems" :key="item.label" class="nav-item">
              <RouterLink
                v-if="item.to !== '#'"
                class="nav-link"
                :class="{ active: isCurrent(item) }"
                :to="item.to"
              >
                {{ item.label }}
              </RouterLink>
              <a v-else class="nav-link" href="#" aria-disabled="true">{{ item.label }}</a>
            </li>
          </ul>
          <a class="btn btn-outline-success btn-sm" href="#">{{ headerAction }}</a>
        </div>
      </div>
    </nav>
  </header>
</template>
