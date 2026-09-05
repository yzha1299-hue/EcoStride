import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ActiveTravelView from '../views/ActiveTravelView.vue'
import ClubsView from '../views/ClubsView.vue'
import EventsView from '../views/EventsView.vue'
import ImpactView from '../views/ImpactView.vue'
import FirebaseSigninView from '../views/FirebaseSigninView.vue'
import FirebaseRegisterView from '../views/FirebaseRegisterView.vue'
import UnauthorizedView from '../views/UnauthorizedView.vue'
import { authReady, role, ROLES, user } from '../auth/authState'

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
      meta: { requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events',
      name: 'events',
      component: EventsView,
      meta: { requiresAuth: true },
    },
    {
      path: '/impact',
      name: 'impact',
      component: ImpactView,
      meta: { requiresAuth: true },
    },
    {
      path: '/FireLogin',
      name: 'FireLogin',
      component: FirebaseSigninView,
    },
    {
      path: '/FireRegister',
      name: 'FireRegister',
      component: FirebaseRegisterView,
    },
    {
      path: '/unauthorized',
      name: 'unauthorized',
      component: UnauthorizedView,
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  await authReady

  if (to.meta.requiresAuth && !user.value) {
    return {
      name: 'FireLogin',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.roles && !to.meta.roles.includes(role.value)) {
    return { name: 'unauthorized' }
  }
})

export default router
