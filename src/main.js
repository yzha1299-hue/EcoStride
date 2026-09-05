import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './assets/main.css'

import { createApp } from 'vue'
import { initializeApp } from 'firebase/app'
import App from './App.vue'
import router from './router'
import { initAuth } from './auth/authState'

const firebaseConfig = {
  apiKey: 'AIzaSyAFueDm0AmMuT0pJDazOi4VOLBlqHvDJ9A',
  authDomain: 'ecostride-82c87.firebaseapp.com',
  projectId: 'ecostride-82c87',
  storageBucket: 'ecostride-82c87.firebasestorage.app',
  messagingSenderId: '551237116306',
  appId: '1:551237116306:web:4ed2cd0467f8e77427614b',
}

initializeApp(firebaseConfig)
initAuth()

const app = createApp(App)

app.use(router)
app.mount('#app')
