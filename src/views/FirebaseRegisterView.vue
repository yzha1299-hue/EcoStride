<template>
  <div class="container py-5">
    <div class="stat-card p-4 p-md-5 mx-auto" style="max-width: 28rem">
      <h1 class="h3 fw-bold mb-3">Create an Account</h1>
      <p class="text-muted mb-4">Choose a role. This controls which pages you can open after sign in.</p>

      <p>
        <input v-model="email" class="form-control" type="text" placeholder="Email" />
      </p>
      <p>
        <input v-model="password" class="form-control" type="password" placeholder="Password" />
      </p>
      <p>
        <select v-model="selectedRole" class="form-select">
          <option :value="ROLES.PARTICIPANT">Participant</option>
          <option :value="ROLES.CLUB_MEMBER">Club member</option>
        </select>
      </p>
      <p>
        <button class="btn btn-success" type="button" @click="register">Save to Firebase</button>
      </p>
      <p v-if="errorMessage" class="text-danger small mb-0">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { useRouter } from 'vue-router'
import { persistRole, ROLES } from '../auth/authState'

const email = ref('')
const password = ref('')
const selectedRole = ref(ROLES.PARTICIPANT)
const errorMessage = ref('')
const router = useRouter()
const auth = getAuth()

const register = () => {
  errorMessage.value = ''
  createUserWithEmailAndPassword(auth, email.value, password.value)
    .then((data) => {
      return updateProfile(data.user, { displayName: selectedRole.value }).then(() => {
        persistRole(data.user.uid, selectedRole.value)
        console.log('Firebase Register Successful!')
        return signOut(auth)
      })
    })
    .then(() => {
      router.push('/FireLogin')
    })
    .catch((error) => {
      console.log(error.code)
      errorMessage.value = error.message
    })
}
</script>
