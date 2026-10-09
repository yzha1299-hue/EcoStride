// Local API for `npm run dev`: rebuilds the function bundle on every change
// and serves it on the Functions emulator at
// http://127.0.0.1:5001/ecostride-82c87/australia-southeast1/api, where
// Vite's dev server proxies /api.
//
// Only the Functions emulator runs, so the function talks to the real
// Firebase project's Firestore and Auth, like the app's front end does in
// development. That needs credentials: set GOOGLE_APPLICATION_CREDENTIALS to
// a service-account key file kept outside the repo (see README).
import { spawn, spawnSync } from 'node:child_process'

const env = { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: '60' }

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.warn('GOOGLE_APPLICATION_CREDENTIALS is not set: the API will not be able to reach Firestore.')
}

const build = spawnSync('npm --prefix functions run build', { shell: true, stdio: 'inherit', env })
if (build.status !== 0) process.exit(build.status ?? 1)

const children = [
  spawn('npm --prefix functions run build:watch', { shell: true, stdio: 'inherit', env }),
  spawn('firebase emulators:start --only functions --project ecostride-82c87', { shell: true, stdio: 'inherit', env }),
]
const stop = () => children.forEach((child) => child.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
