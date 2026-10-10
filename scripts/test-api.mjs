// Runs the API integration tests (tests/api) against the API function on the
// Firebase emulators: builds the function bundle, then starts the Functions,
// Firestore and Auth emulators under the offline demo-ecostride project.
//
// The Functions emulator loads the code in a separate process and gives up
// after 10 s by default, which a cold start on Windows (with the Java
// emulators starting at the same time) can exceed; 60 s is allowed instead.
import { spawnSync } from 'node:child_process'
import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs'

const run = (command) => {
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: '60' },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// The tests assume no email, map or AI secrets, so a developer's real keys in
// functions/.secret.local must not leak in: the emulator would send real
// email. The file is moved aside for the run and always put back; the run
// gets its own file with only the public API's test keys.
const SECRETS = 'functions/.secret.local'
const ASIDE = `${SECRETS}.aside`
if (existsSync(ASIDE)) {
  console.error(`${ASIDE} is left over from an interrupted run. Move it back to ${SECRETS} and try again.`)
  process.exit(1)
}
const hadSecrets = existsSync(SECRETS)
if (hadSecrets) renameSync(SECRETS, ASIDE)
writeFileSync(SECRETS, 'PUBLIC_API_KEYS=demo:demo-test-key,burst:burst-test-key\n')
// The emulator writes the parameters it resolved for the offline test project
// (empty here) to functions/.env.local, which would then override the real
// values in functions/.env.ecostride-82c87 when `npm run dev:api` runs.
const GENERATED_ENV = 'functions/.env.local'
const restore = () => {
  rmSync(SECRETS, { force: true })
  if (hadSecrets && existsSync(ASIDE)) renameSync(ASIDE, SECRETS)
  rmSync(GENERATED_ENV, { force: true })
}
process.on('exit', restore)
process.on('SIGINT', () => process.exit(130))

run('npm --prefix functions run build')
run(
  'firebase emulators:exec --only functions,firestore,auth --project demo-ecostride "vitest run --project api"',
)
