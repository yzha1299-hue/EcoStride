import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { apiOriginForCsp } from './scripts/cspApiOrigin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue(),
    vueDevTools(),
    {
      // Puts the API's origin into the Content-Security-Policy in index.html,
      // but only when the API is not on the site's own origin.
      name: 'csp-api-origin',
      transformIndexHtml: (html) =>
        html.replace('%API_ORIGIN%', apiOriginForCsp(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL)),
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // In production Firebase Hosting sends /api/** to the API function; in
    // development the same paths go to the function on the Functions emulator
    // (`npm run dev:api`), so the app calls /api the same way in both.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        rewrite: (path) => `/ecostride-82c87/australia-southeast1/api${path}`,
      },
    },
  },
}))
