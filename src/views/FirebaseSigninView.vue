<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <h1 class="h3 fw-bold mb-3">Sign in</h1>
      <p>
        <input v-model="email" class="form-control" type="text" placeholder="Email" />
      </p>
      <p>
        <input v-model="password" class="form-control" type="password" placeholder="Password" />
      </p>
      <p>
        <button class="btn btn-success" type="button" @click="signin">Sign in via Firebase</button>
      </p>
      <p v-if="errorMessage" class="text-danger small mb-0">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { useRoute, useRouter } from 'vue-router'
import { persistRole, resolveRole } from '../auth/authState'

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const router = useRouter()
const route = useRoute()
const auth = getAuth()

const signin = () => {
  errorMessage.value = ''
  signInWithEmailAndPassword(getAuth(), email.value, password.value)
    .then((data) => {
      const nextRole = resolveRole(data.user)
      persistRole(data.user.uid, nextRole)
      console.log('Firebase Sign in Successful!')
      console.log(auth.currentUser)
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
      router.push(redirect)
    })
    .catch((error) => {
      console.log(error.code)
      errorMessage.value = error.message
    })
}
</script>
