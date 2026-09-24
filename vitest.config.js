import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.js', 'shared/**/*.test.js', 'worker/src/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'rules',
          include: ['tests/rules/**/*.test.js'],
          environment: 'node',
          // Every rules test file shares one emulator database and clears it
          // between tests, so files must not run in parallel.
          fileParallelism: false,
          testTimeout: 15000,
          hookTimeout: 30000,
        },
      },
    ],
  },
})
