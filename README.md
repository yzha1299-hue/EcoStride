# EcoStride

This template should help get you started developing with Vue 3 in Vite.

## App Data

Events are stored in Firestore and loaded through `src/composables/useEvents.js` (see "Seed sample events" below).
Other content is still loaded from JavaScript data structures in `src/data/ecostrideData.js` through `src/composables/useJsonData.js`, using keys like `home`, `clubs`, and `impact`.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Tests

```sh
npm test            # everything
npm run test:unit   # Vitest unit tests (no emulator needed)
npm run test:rules  # Firestore security rules, on the local emulator
```

Rules tests need Java 11+ and the Firebase CLI (`npm install -g firebase-tools`). `test:rules` starts the Firestore emulator under the offline `demo-ecostride` project, runs `tests/rules/` against `firestore.rules` acting as different signed-in users, then shuts the emulator down. It never touches the real project.

### Seed sample events

Events live in Firestore. `npm run seed:events` writes five sample events (dated a few days to two weeks from today, Melbourne time) plus demo registrations using `example.com` addresses. It keeps the original event IDs so existing ratings still attach, and re-running it replaces them.

```sh
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\ecostride-worker-key.json"  # outside the repo
$env:SEED_CREATOR_UID = "<uid of a club-member account>"
npm run seed:events
```

The key can be one for the Worker's `ecostride-worker` service account (Cloud Datastore User is enough). `SEED_CREATOR_UID` becomes each event's `createdBy`, so that club member can manage them; find it in Firebase console > Authentication > Users.

To try it without touching real data, run it against the emulator:
`firebase emulators:exec --only firestore --project demo-ecostride "node scripts/seed-events.mjs"` (with `SEED_CREATOR_UID` set).

### Deploy to Firebase Hosting

One-time setup:

1. Install the CLI and sign in: `npm install -g firebase-tools`, then `firebase login`.
2. In the Firebase console, enable **Authentication > Sign-in method > Google**.
3. Check **Authentication > Settings > Authorized domains** lists `ecostride-82c87.web.app`, `ecostride-82c87.firebaseapp.com` and `localhost` (Firebase adds these by default).

Each deploy:

```sh
npm run build
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

The app uses HTML5 history routing, so `firebase.json` rewrites every path that is not a real file to `index.html`. Without it, opening or refreshing a deep link such as `/events` returns a 404. Hashed files under `/assets` are cached for a year; `index.html` is never cached so new deploys take effect immediately.

### API Worker (Cloudflare Workers)

Server-side logic lives in `worker/` and is deployed separately from the site. It verifies the caller's Firebase ID token itself (with `jose`) and talks to Firestore over its REST API using a service account, because `firebase-admin` does not run on Workers.

One-time setup:

1. **Service account with least privilege.** In Google Cloud console for project `ecostride-82c87`: IAM & Admin > Service Accounts > Create, name it e.g. `ecostride-worker`, and grant only the **Cloud Datastore User** role. Then Keys > Add key > JSON. Keep the file outside the repo.
2. `cd worker && npm install && npx wrangler login`
3. Store the key as a secret by piping the file in (the interactive prompt keeps only the first line of a multi-line paste):
   `Get-Content C:\keys\ecostride-worker-key.json -Raw | npx wrangler secret put FIREBASE_SERVICE_ACCOUNT` (PowerShell)
4. `npm run deploy` and note the URL it prints (e.g. `https://ecostride-api.<subdomain>.workers.dev`).
5. Set `VITE_API_BASE_URL` in the root `.env` to that URL, then rebuild and redeploy the site. The URL is also inserted into the page's Content-Security-Policy at build time.

Email (Brevo, free tier) - needed for "Email me the roster" and emailing registrants:

1. Create a Brevo account. Under **Senders, Domains & Dedicated IPs > Senders**, add the address emails should come from and click the link Brevo sends to verify it. Brevo rejects mail from unverified senders.
2. Under **SMTP & API > API Keys**, create a v3 API key.
3. In `worker/`: `npx wrangler secret put BREVO_API_KEY` and `npx wrangler secret put BREVO_SENDER_EMAIL` (the verified address; kept as a secret so a personal address stays out of the repo), then `npm run deploy`.

Until both are set, email endpoints answer `EMAIL_UNAVAILABLE`. All sending goes through `worker/src/core/email.js`, so changing provider means changing that one file.

Local development: copy `worker/.dev.vars.example` to `worker/.dev.vars` (git-ignored), then `npm run dev` in `worker/`, and point `VITE_API_BASE_URL` at `http://localhost:8787`.

Check it works: sign in on the dev site, open the browser console and run `await ecoApi.me()`. It should return your uid, email, whether it's verified, and your role read from Firestore.

Allowed browser origins are listed in `ALLOWED_ORIGINS` in `worker/wrangler.toml`.

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
