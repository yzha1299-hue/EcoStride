<script setup>
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import EmailVerificationNotice from './components/EmailVerificationNotice.vue'
</script>

<template>
  <div class="app-shell d-flex flex-column min-vh-100">
    <AppHeader />
    <EmailVerificationNotice />
    <main class="flex-grow-1">
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>
