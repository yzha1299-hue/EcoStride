import { readFileSync } from 'node:fs'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'

// A "demo-" project ID keeps the emulator fully offline: it can never reach the
// real ecostride-82c87 project. The emulator host comes from the
// FIRESTORE_EMULATOR_HOST variable that `firebase emulators:exec` sets.
export const PROJECT_ID = 'demo-ecostride'

export function createRulesEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
}

// Firestore clients acting as a given identity; `email` becomes the
// request.auth.token.email the rules check against.
export function signedInAs(env, uid, email = `${uid}@example.com`) {
  return env.authenticatedContext(uid, { email }).firestore()
}

export function signedOut(env) {
  return env.unauthenticatedContext().firestore()
}

// Writes data as an admin (rules bypassed) to arrange a test's starting state.
export async function seed(env, path, data) {
  await env.withSecurityRulesDisabled(async (context) => {
    const { doc, setDoc } = await import('firebase/firestore')
    await setDoc(doc(context.firestore(), path), data)
  })
}
