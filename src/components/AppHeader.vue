<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../auth/authState'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, isAdmin, isClubMember, roleLabel, user, logout } = useAuth()

// Pages everyone can use first, then the ones that depend on the signed-in role.
const navItems = computed(() => {
  const items = [
    { label: 'Home', to: '/' },
    { label: 'Events', to: '/events' },
    { label: 'Active Travel', to: '/active-travel' },
    { label: 'Clubs', to: '/clubs' },
    { label: 'Impact', to: '/impact' },
  ]

  if (isClubMember.value) {
    items.push({ label: 'Manage events', to: '/events/manage' })
  }

  if (isAdmin.value) {
    items.push({ label: 'Admin', to: '/admin' })
  }

  return items
})

// The item whose section the current page belongs to: the longest link that is
// the page itself or a parent of it, so /events/manage/new lights up
// "Manage events" rather than "Events".
const currentItem = computed(() => {
  const path = route.path
  const matches = navItems.value.filter(
    (item) => path === item.to || (item.to !== '/' && path.startsWith(`${item.to}/`)),
  )
  return matches.sort((a, b) => b.to.length - a.to.length)[0] ?? null
})

const initial = computed(() => (user.value?.email?.[0] ?? '?').toUpperCase())

async function signOutUser() {
  await logout()
  router.push('/')
}
</script>

<template>
  <header class="site-header">
    <nav class="navbar navbar-expand-lg site-nav" aria-label="Main">
      <div class="container">
        <RouterLink class="navbar-brand d-flex align-items-center gap-2 me-lg-4" to="/">
          <span class="brand-mark" aria-hidden="true">ES</span>
          <span class="brand-lockup">
            <span class="brand-text">EcoStride</span>
            <span class="brand-sub">Melbourne</span>
          </span>
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
          <ul class="navbar-nav site-nav-links me-auto mb-2 mb-lg-0">
            <li v-for="item in navItems" :key="item.label" class="nav-item">
              <RouterLink class="nav-link" :class="{ active: item === currentItem }" :to="item.to">
                {{ item.label }}
              </RouterLink>
            </li>
          </ul>

          <div class="site-nav-account d-flex flex-column flex-lg-row align-items-lg-center gap-2">
            <template v-if="isAuthenticated">
              <div class="user-chip" :title="user.email">
                <span class="user-avatar" aria-hidden="true">{{ initial }}</span>
                <span class="user-details">
                  <span class="user-role">{{ roleLabel }}</span>
                  <span class="user-email">{{ user.email }}</span>
                </span>
              </div>
              <button class="btn btn-outline-success btn-sm rounded-pill px-3" type="button" @click="signOutUser">
                Sign out
              </button>
            </template>
            <template v-else>
              <RouterLink class="nav-link sign-in-link" to="/FireLogin">Sign in</RouterLink>
              <RouterLink class="btn btn-success btn-sm rounded-pill px-3" to="/FireRegister">Register</RouterLink>
            </template>
          </div>
        </div>
      </div>
    </nav>
  </header>
</template>
