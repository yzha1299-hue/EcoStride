// Grants or revokes the admin role for an existing EcoStride account.
//
//   GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json \
//   node scripts/make-admin.mjs <uid>            # make admin
//   node scripts/make-admin.mjs <uid> --revoke   # back to participant
//
// Runs locally with the Admin SDK, which bypasses security rules - the only
// way to set role 'admin', since the rules never accept it from a browser.
// The account must already exist and have a profile (sign up and choose a
// role first). Find the uid in Firebase console > Authentication > Users.
// Against the emulator, set FIRESTORE_EMULATOR_HOST instead of credentials.
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'ecostride-82c87'

async function main() {
  const [uid, flag] = process.argv.slice(2)
  if (!uid || (flag && flag !== '--revoke')) {
    throw new Error('Usage: node scripts/make-admin.mjs <uid> [--revoke]')
  }
  const useEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST)
  if (!useEmulator && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key file (see README).')
  }
  initializeApp(
    useEmulator
      ? { projectId: process.env.GCLOUD_PROJECT || PROJECT_ID }
      : { credential: applicationDefault(), projectId: PROJECT_ID },
  )

  const ref = getFirestore().collection('users').doc(uid)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    throw new Error(`No profile for ${uid}. Sign in with that account and choose a role first.`)
  }
  const role = flag === '--revoke' ? 'participant' : 'admin'
  await ref.update({ role })
  console.log(`${snapshot.data().email}: role ${snapshot.data().role} -> ${role}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
