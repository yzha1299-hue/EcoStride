import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ActiveTravelView from '../views/ActiveTravelView.vue'
import ClubsView from '../views/ClubsView.vue'
import EventsView from '../views/EventsView.vue'
import ManageEventsView from '../views/ManageEventsView.vue'
import EventFormView from '../views/EventFormView.vue'
import RosterView from '../views/RosterView.vue'
import ImpactView from '../views/ImpactView.vue'
import FirebaseSigninView from '../views/FirebaseSigninView.vue'
import FirebaseRegisterView from '../views/FirebaseRegisterView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import CompleteProfileView from '../views/CompleteProfileView.vue'
import UnauthorizedView from '../views/UnauthorizedView.vue'
import { authReady, hasProfile, role, ROLES, user } from '../auth/authState'

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
      path: '/events/manage',
      name: 'events-manage',
      component: ManageEventsView,
      meta: { requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events/manage/new',
      name: 'event-create',
      component: EventFormView,
      meta: { requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events/manage/:id/edit',
      name: 'event-edit',
      component: EventFormView,
      meta: { requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events/manage/:id/roster',
      name: 'event-roster',
      component: RosterView,
      meta: { requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
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
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
    },
    {
      path: '/complete-profile',
      name: 'complete-profile',
      component: CompleteProfileView,
      meta: { requiresAuth: true },
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

  if (user.value && !hasProfile.value && to.name !== 'complete-profile') {
    // Keep where the user was heading so they land there once a role is chosen.
    const redirect = to.name === 'FireLogin' || to.name === 'FireRegister' ? undefined : to.fullPath
    return { name: 'complete-profile', query: redirect ? { redirect } : {} }
  }

  if (to.meta.roles && !to.meta.roles.includes(role.value)) {
    return { name: 'unauthorized' }
  }
})

export default router
