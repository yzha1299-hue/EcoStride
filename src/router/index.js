import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ActiveTravelView from '../views/ActiveTravelView.vue'
import ClubsView from '../views/ClubsView.vue'
import EventsView from '../views/EventsView.vue'
import ImpactView from '../views/ImpactView.vue'

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
    {
      path: '/clubs',
      name: 'clubs',
      component: ClubsView,
    },
    {
      path: '/events',
      name: 'events',
      component: EventsView,
    },
    {
      path: '/impact',
      name: 'impact',
      component: ImpactView,
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
