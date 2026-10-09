// Runs the API integration tests (tests/api) against the API function on the
// Firebase emulators: builds the function bundle, then starts the Functions,
// Firestore and Auth emulators under the offline demo-ecostride project.
//
// The Functions emulator loads the code in a separate process and gives up
// after 10 s by default, which a cold start on Windows (with the Java
// emulators starting at the same time) can exceed; 60 s is allowed instead.
import { spawnSync } from 'node:child_process'

const run = (command) => {
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: '60' },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npm --prefix functions run build')
run(
  'firebase emulators:exec --only functions,firestore,auth --project demo-ecostride "vitest run --project api"',
)
