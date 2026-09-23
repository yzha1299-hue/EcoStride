import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/main.css'

import { createApp } from 'vue'
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import App from './App.vue'
import router from './router'
import { initAuth } from './auth/authState'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

initializeApp(firebaseConfig)
getFirestore()
initAuth()

if (import.meta.env.DEV) {
  // Dev-only hook for checking the API from the browser console: await ecoApi.me()
  import('./api/client').then(({ getMe }) => {
    window.ecoApi = { me: getMe }
  })
}

const app = createApp(App)

app.use(router)
app.mount('#app')
