import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ActiveTravelView from '../views/ActiveTravelView.vue'
import ClubsView from '../views/ClubsView.vue'
import EventsView from '../views/EventsView.vue'
import ManageEventsView from '../views/ManageEventsView.vue'
import EventFormView from '../views/EventFormView.vue'
import RosterView from '../views/RosterView.vue'
import EmailRegistrantsView from '../views/EmailRegistrantsView.vue'
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
      meta: { title: 'Home' },
    },
    {
      path: '/active-travel',
      name: 'active-travel',
      component: ActiveTravelView,
      meta: { title: 'Find safe routes' },
    },
    {
      path: '/clubs',
      name: 'clubs',
      component: ClubsView,
      meta: { title: 'Club tools', requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events',
      name: 'events',
      component: EventsView,
      meta: { title: 'Upcoming events', requiresAuth: true },
    },
    {
      path: '/events/manage',
      name: 'events-manage',
      component: ManageEventsView,
      meta: { title: 'Manage events', requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events/manage/new',
      name: 'event-create',
      component: EventFormView,
      meta: { title: 'Create an event', requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events/manage/:id/edit',
      name: 'event-edit',
      component: EventFormView,
      meta: { title: 'Edit event', requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events/manage/:id/roster',
      name: 'event-roster',
      component: RosterView,
      meta: { title: 'Event roster', requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/events/manage/:id/email',
      name: 'event-email',
      component: EmailRegistrantsView,
      meta: { title: 'Email registrants', requiresAuth: true, roles: [ROLES.CLUB_MEMBER] },
    },
    {
      path: '/impact',
      name: 'impact',
      component: ImpactView,
      meta: { title: 'Impact', requiresAuth: true },
    },
    {
      path: '/FireLogin',
      name: 'FireLogin',
      component: FirebaseSigninView,
      meta: { title: 'Sign in' },
    },
    {
      path: '/FireRegister',
      name: 'FireRegister',
      component: FirebaseRegisterView,
      meta: { title: 'Register' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: ForgotPasswordView,
      meta: { title: 'Reset your password' },
    },
    {
      path: '/complete-profile',
      name: 'complete-profile',
      component: CompleteProfileView,
      meta: { title: 'Complete your profile', requiresAuth: true },
    },
    {
      path: '/unauthorized',
      name: 'unauthorized',
      component: UnauthorizedView,
      meta: { title: 'Access denied' },
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

// Every page gets its own title (announced first by screen readers, shown in
// tabs and history). afterEach also covers the very first page load.
router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | EcoStride Melbourne` : 'EcoStride Melbourne'
})

export default router
