<script setup>
import { useAuth } from '../auth/authState'

const { isAuthenticated, isClubMember } = useAuth()
</script>

<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 40rem">
      <h1 class="h3 fw-bold mb-3">Access denied</h1>
      <p class="text-muted">
        This page needs a different EcoStride role. Club tools are only available to Club members.
      </p>
      <p v-if="isAuthenticated && !isClubMember" class="text-muted">
        You are signed in as a Participant. Register or sign in with a Club member account to open
        this page.
      </p>
      <div class="d-flex flex-wrap gap-2">
        <RouterLink class="btn btn-success" to="/">Back to home</RouterLink>
        <RouterLink v-if="!isAuthenticated" class="btn btn-outline-success" to="/FireLogin">
          Sign in
        </RouterLink>
      </div>
    </div>
  </div>
</template>
