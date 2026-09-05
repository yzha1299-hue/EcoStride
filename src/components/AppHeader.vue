<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../auth/authState'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, isClubMember, roleLabel, user, logout } = useAuth()

const navItems = computed(() => {
  const items = [
    { label: 'Home', to: '/' },
    { label: 'Active Travel', to: '/active-travel' },
  ]

  if (!isAuthenticated.value || isClubMember.value) {
    items.push({ label: 'Clubs', to: '/clubs' })
  }

  items.push(
    { label: 'Gear', to: '#' },
    { label: 'Events', to: '/events' },
    { label: 'Impact', to: '/impact' },
    { label: 'Help', to: '#' },
  )

  if (!isAuthenticated.value) {
    items.push({ label: 'Sign in', to: '/FireLogin' }, { label: 'Register', to: '/FireRegister' })
  }

  return items
})

function isCurrent(item) {
  return item.to !== '#' && route.path === item.to
}

async function signOutUser() {
  await logout()
  router.push('/')
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
          <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
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
            <li v-if="isAuthenticated" class="nav-item d-flex align-items-center">
              <span class="nav-link disabled small">{{ roleLabel }} · {{ user.email }}</span>
            </li>
            <li v-if="isAuthenticated" class="nav-item">
              <button class="nav-link btn btn-link" type="button" @click="signOutUser">
                Sign out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  </header>
</template>
