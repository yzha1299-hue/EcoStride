import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ActiveTravelView from '../views/ActiveTravelView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/active-travel',
      name: 'active-travel',
      component: ActiveTravelView,
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
