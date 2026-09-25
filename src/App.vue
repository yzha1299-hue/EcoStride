<script setup>
import { nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import EmailVerificationNotice from './components/EmailVerificationNotice.vue'

const route = useRoute()
const router = useRouter()
const main = ref(null)
// The first page load is a real load; only later navigations move focus.
let initialNavigationDone = false
router.isReady().then(() => {
  initialNavigationDone = true
})

// A single-page app doesn't reload between pages, so after navigating it does
// what a page load would: start focus at the new page's heading instead of
// leaving it on a link that may no longer exist. (Page titles: see router.)
watch(
  () => route.path,
  async (path, previousPath) => {
    if (!initialNavigationDone || previousPath === path) return
    await nextTick()
    const heading = main.value?.querySelector('h1')
    const target = heading ?? main.value
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
    target?.focus({ preventScroll: true })
  },
)
</script>

<template>
  <div class="app-shell d-flex flex-column min-vh-100">
    <a class="skip-link visually-hidden-focusable" href="#main-content">Skip to main content</a>
    <AppHeader />
    <EmailVerificationNotice />
    <main id="main-content" ref="main" class="flex-grow-1" tabindex="-1">
      <RouterView />
    </main>
    <AppFooter />
  </div>
</template>
