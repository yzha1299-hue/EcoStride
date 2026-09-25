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

The app uses HTML5 history routing, so `firebase.json` rewrites every path that is not a real file to `index.html`. Without it, opening or refreshing a deep link such as `/events` returns a 404. Hashed files under `/assets` are cached for a year. The app shell - `/`, `index.html` and every extension-less route such as `/events`, which are all rewritten to `index.html` - is served `no-cache`, so a new deploy takes effect on the next page load. (Firebase matches header rules against the requested path, not the rewritten one, so a rule for `/index.html` alone leaves `/events` on the default one-hour cache.)

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

Maps (Active Travel and the events map):

1. Create a free account at openrouteservice.org and copy a token from its Dashboard.
2. In `worker/`: `npx wrangler secret put ORS_API_KEY`, then `npm run deploy`.

Place search (Nominatim) and nearby facilities (Overpass) need no key; the Worker identifies itself with the `NOMINATIM_USER_AGENT` in `wrangler.toml`, as their usage policies require. Map endpoints need a signed-in caller.

Local development: copy `worker/.dev.vars.example` to `worker/.dev.vars` (git-ignored), then `npm run dev` in `worker/`, and point `VITE_API_BASE_URL` at `http://localhost:8787`.

Check it works: sign in on the dev site, open the browser console and run `await ecoApi.me()`. It should return your uid, email, whether it's verified, and your role read from Firestore.

Allowed browser origins are listed in `ALLOWED_ORIGINS` in `worker/wrangler.toml`.

### Serverless design

The site is static files on Firebase Hosting; everything that must not run in the browser runs as a Cloudflare Worker (`worker/`). Each request is a separate function invocation: there is no server to keep running.

**Why each endpoint runs on the server**

| Endpoint | Why it can't be done in the browser |
| --- | --- |
| `GET /me` | Proves the whole chain works: the Worker verifies the Firebase ID token itself and reads Firestore with a service account. |
| `POST /registrations`, `POST /registrations/cancel` | The capacity cap. Registration and the event's `registeredCount` change in one Firestore commit, preconditioned on the event not having changed since it was read; the loser of a race re-reads and gets "full". Security rules alone can't compare a count to the number of documents, so clients may not write registrations at all. The registrant's email comes from the verified token, not the request. |
| `POST /events/roster-email` | Holds the Brevo API key; reads registrant data the caller may see only as the event's creator; sends only to the caller's own verified address. |
| `POST /events/email-registrants` | Holds the Brevo API key; loads recipients on the server so a caller can't email arbitrary addresses; enforces the 5-per-event-per-day limit in a record clients can't touch; re-checks attachment type, size and file signature. |
| `POST /geo/search` | Proxies Nominatim with an identifying User-Agent and at most one request per second, which a browser can't guarantee across users. |
| `POST /geo/directions` | Keeps the OpenRouteService key out of the bundle and caches routes to stay within its free quota. |
| `POST /geo/nearby` | Proxies Overpass with one efficient query, caching and a single place to handle its rate limiting. |

Every endpoint verifies the caller's Firebase ID token (signature against Google's keys, issuer, audience, expiry), validates the request body (types, lengths, unknown fields rejected), and answers other websites' browsers with no CORS headers. Business logic lives in platform-agnostic handlers (`worker/src/handlers`); `worker/src/index.js` is the only Workers-specific file.

**Benefits of serverless here**

- No server to run, patch or pay for while idle: the Worker scales to zero and up automatically with traffic.
- Pay per request, and the free tier (100,000 requests/day) comfortably covers this app.
- Runs at Cloudflare's edge, close to users; there is no always-on instance to fail.
- Secrets (service account, Brevo and ORS keys) live in the platform's secret store, never in the repo or the bundle.

**Costs and limits**

- The free plan allows about 10 ms of CPU per request. Signing a service-account token costs RSA time, so Google access tokens and signing keys are cached per isolate; uploads are passed to Brevo still base64-encoded rather than decoded and re-encoded.
- Isolates are short-lived and don't share memory, so caches and the Nominatim one-per-second throttle are per isolate, not global. (Cloudflare's Cache API does nothing on `*.workers.dev`.)
- Cold starts add a little latency to the first request an isolate serves.
- Vendor lock-in and a smaller ecosystem: `firebase-admin` doesn't run on Workers, so token verification (`jose`) and Firestore access (REST API) are written by hand.
- Two platforms to deploy and monitor (Firebase and Cloudflare).

**Why Cloudflare Workers rather than Firebase Cloud Functions**

Cloud Functions require the paid Blaze plan (a billing account), which this project avoids; Workers' free tier needs no card. Workers also start faster (no container cold start) and run close to users. The price is the hand-written token verification and Firestore REST client described above, which in turn keeps the security-critical code small and explainable.

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
