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
npm run test:api    # the API function end to end, on the Functions, Firestore and Auth emulators
```

Rules tests need Java 11+ and the Firebase CLI (`npm install -g firebase-tools`). `test:rules` starts the Firestore emulator under the offline `demo-ecostride` project, runs `tests/rules/` against `firestore.rules` acting as different signed-in users, then shuts the emulator down. It never touches the real project.

### Seed sample events

Events live in Firestore. `npm run seed:events` writes five sample events (dated a few days to two weeks from today, Melbourne time) plus demo registrations using `example.com` addresses. It keeps the original event IDs so existing ratings still attach, and re-running it replaces them.

```sh
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\ecostride-admin-key.json"  # outside the repo
$env:SEED_CREATOR_UID = "<uid of a club-member account>"
npm run seed:events
```

The key is for a service account that may use Firestore (Cloud Datastore User is enough), for example the Firebase Admin SDK account (Firebase console > Project settings > Service accounts > Generate new private key). Keep it outside the repo; the deployed function's own account, `ecostride-api`, deliberately has no key. `SEED_CREATOR_UID` becomes each event's `createdBy`, so that club member can manage them; find it in Firebase console > Authentication > Users.

To try it without touching real data, run it against the emulator:
`firebase emulators:exec --only firestore --project demo-ecostride "node scripts/seed-events.mjs"` (with `SEED_CREATOR_UID` set).

### Make an admin

Admins (EcoStride staff) see the Admin dashboard (`/admin`) with user and event numbers. The role can't be chosen at sign-up or changed in the browser; grant it from your machine with the Admin SDK, using the same key as the seed script:

```sh
# PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\keys\ecostride-admin-key.json"
npm run make-admin -- <uid>            # make admin
npm run make-admin -- <uid> --revoke   # back to participant
```

The account must have signed up and chosen a role first. Find its uid in Firebase console > Authentication > Users. The user sees the change after signing in again (or reloading).

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

(The API function has its own deploy; see "API on Cloud Functions" below.)

The app uses HTML5 history routing, so `firebase.json` rewrites every path that is not a real file to `index.html`. Without it, opening or refreshing a deep link such as `/events` returns a 404. Hashed files under `/assets` are cached for a year. The app shell - `/`, `index.html` and every extension-less route such as `/events`, which are all rewritten to `index.html` - is served `no-cache`, so a new deploy takes effect on the next page load. (Firebase matches header rules against the requested path, not the rewritten one, so a rule for `/index.html` alone leaves `/events` on the default one-hour cache.)

### API on Cloud Functions

Server-side logic is one 2nd-generation Cloud Function, `api`, in `australia-southeast1` (next to Firestore). Firebase Hosting serves it on the site's own origin: `firebase.json` rewrites `/api/**` to the function, so the app calls `/api/...` with no CORS and no second origin. It uses the Firebase Admin SDK. Why it runs here rather than on Cloudflare Workers, where it started: [docs/adr/0001-api-on-cloud-functions.md](docs/adr/0001-api-on-cloud-functions.md).

- **Code:** `functions/src` (handlers, pure modules and their unit tests). `functions/src/index.js` is the entry point and routing table; `functions/src/http.js` is the HTTP adapter (routing, body limits, identity, error shape, logging); `functions/src/public/publicApi.js` serves the partner-facing public API. Cloud Functions uploads only `functions/`, so `npm --prefix functions run build` bundles `functions/src` and `shared/` into `functions/lib/` with esbuild; `firebase deploy` runs it as a predeploy step.
- **Service account:** the function runs as `ecostride-api@ecostride-82c87.iam.gserviceaccount.com`, created once in Google Cloud console > IAM & Admin > Service Accounts with only the **Cloud Datastore User** role and no keys. Deploying also grants it read access to the secrets below.
- **Secrets** (Secret Manager; set each with `firebase functions:secrets:set NAME --project ecostride-82c87`, paste the value, then redeploy):

  | Secret | Used for |
  | --- | --- |
  | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` | Email (see below) |
  | `ORS_API_KEY` | Directions (OpenRouteService token from openrouteservice.org > Dashboard) |
  | `GEMINI_API_KEY` | "Draft with AI" (Google AI Studio > Get API key) |
  | `PUBLIC_API_KEYS` | Public API callers, comma-separated `name:key` pairs ([docs/public-api.md](docs/public-api.md)) |

- **Parameters** (not secret; `functions/.env.ecostride-82c87`): `NOMINATIM_USER_AGENT` (Nominatim and Overpass require a User-Agent that identifies the app), `GEMINI_MODEL` (if AI Studio's **Rate limits** page shows no free quota for it, switch to one that has) and `PUBLIC_SITE_URL`. An endpoint whose secret or parameter is empty answers `EMAIL_UNAVAILABLE`, `GEO_UNAVAILABLE` or `AI_UNAVAILABLE` instead of failing.
- **Email (Brevo, free tier)** for "Email me the roster" and emailing registrants: create a Brevo account; under **Senders, Domains & Dedicated IPs > Senders** add the address emails come from and click the link Brevo sends (it rejects mail from unverified senders); under **SMTP & API > API Keys** create a v3 API key. Brevo only shows a key once, so keep it. All sending goes through `functions/src/core/email.js`, so changing provider means changing that one file.
- **Deploy:** `firebase deploy --only functions --project ecostride-82c87`. On Windows the first analysis of the code can exceed the CLI's 10 s default, so set `FUNCTIONS_DISCOVERY_TIMEOUT=60` for the command (PowerShell: `$env:FUNCTIONS_DISCOVERY_TIMEOUT = "60"`). The first ever deploy enables the Cloud Functions, Cloud Build, Artifact Registry, Cloud Run and Secret Manager APIs. Deploy Hosting separately (above) when the front end changes.
- **Local API:** `npm run dev:api` rebuilds on change and serves the function on the Functions emulator, and `npm run dev` proxies `/api` to it. Only the Functions emulator runs, so the function talks to the real project's Firestore and Auth: set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account key outside the repo first. Put real keys in `functions/.secret.local` (git-ignored, `NAME=value` per line, no quotes). To make the app use the local API, put `VITE_API_BASE_URL=/api` in `.env.development.local` (not `.env.local`, which production builds read too). Local email goes out for real, to real registrants, so use a test event.
- **Tests:** `npm run test:api` builds the function and runs `tests/api` against it on the Functions, Firestore and Auth emulators (offline `demo-ecostride` project), with real ID tokens from the Auth emulator. It moves `functions/.secret.local` aside for the run (and puts it back) so real keys can never leak into tests.
- **Cost and safety:** `maxInstances` is capped at 10 so a spike or abuse cannot scale without limit, and `minInstances` stays 0. Set a Google Cloud budget with email alerts (Billing > Budgets & alerts; for example AUD 5 a month). The free tiers (function invocations, Secret Manager secret versions, Cloud Build and Artifact Registry storage for function images) are expected to cover this app. What could still incur cost on Blaze: invocations or compute beyond the free tier, Artifact Registry storage if old function images pile up, and Secret Manager if many secret versions accumulate.
- **Logs:** Firebase console > Functions > `api` > Logs. Each request logs one structured line (endpoint, uid or API-key name, status, outcome, duration), never emails, names or request bodies; failed calls to other services log the status and a short detail.

### Serverless design

The site is static files on Firebase Hosting; everything that must not run in the browser runs in the `api` Cloud Function. Each request is a function invocation on a container that Google starts and stops: there is no server to keep running.

**Why each endpoint runs on the server**

| Endpoint | Why it can't be done in the browser |
| --- | --- |
| `GET /api/me` | Proves the whole chain works: the function verifies the Firebase ID token with the Admin SDK and reads the caller's role from Firestore. |
| `POST /api/registrations`, `POST /api/registrations/cancel` | The capacity cap. Registration and the event's `registeredCount` change in one Firestore transaction; transactions on the same event run one after another, so the loser of a race re-reads the event and gets "full". Security rules alone can't compare a count to the number of documents, so clients may not write registrations at all. The registrant's email comes from the verified token, not the request. |
| `POST /api/events/roster-email` | Holds the Brevo API key; reads registrant data the caller may see only as the event's creator; sends only to the caller's own verified address. |
| `POST /api/events/email-registrants` | Holds the Brevo API key; loads recipients on the server so a caller can't email arbitrary addresses; enforces the 5-per-event-per-day limit in a record clients can't touch; re-checks attachment type, size and file signature. |
| `POST /api/geo/search` | Proxies Nominatim with an identifying User-Agent and at most one request per second, which a browser can't guarantee across users. |
| `POST /api/geo/directions` | Keeps the OpenRouteService key out of the bundle and caches routes to stay within its free quota. |
| `POST /api/geo/nearby` | Proxies Overpass with one efficient query, caching, and a fall-back across several public servers (any one is often overloaded). |
| `POST /api/ai/draft` | Keeps the Gemini key off the browser; builds the prompt from event details the function reads itself, so no registrant data can reach the AI service; enforces 20 drafts per club member per day. |
| `GET /api/public/v1/events`, `GET /api/public/v1/events/{id}` | Lets other sites read events without Firestore credentials; the function decides exactly which fields leave the platform (no personal data), checks API keys and rate-limits each partner. |

Every private endpoint verifies the caller's Firebase ID token (signature against Google's keys, issuer, audience, expiry), validates the request body (types, lengths, unknown fields rejected), and sends no CORS headers, so other websites' browsers can't read its responses. Only the public API is open to any origin. Business logic lives in platform-agnostic handlers (`functions/src/handlers`); `functions/src/index.js` and `functions/src/http.js` are the only files that know about Cloud Functions.

**Benefits of serverless here**

- No server to run, patch or pay for while idle: the function scales to zero and up automatically with traffic, within the `maxInstances` cap.
- Pay per use, and the free tier comfortably covers this app.
- One platform: hosting, auth, database, API, secrets and logs are all in Firebase / Google Cloud, with one deploy.
- Same origin as the site: no CORS preflight and no second connection.
- Least privilege: the function runs as an account that can only use Firestore, with no key file; secrets live in Secret Manager, never in the repo or the bundle.
- Tested end to end: `tests/api` exercises the real function on the emulators.

**Costs and limits**

- Cold starts: after idle the first request starts a container, so it is slower than on an always-warm edge runtime. `minInstances` stays 0 to avoid paying for idle capacity.
- Caches, the public API's rate limit and the Nominatim one-per-second throttle live in each instance's memory, so they apply per instance, not globally. With `maxInstances` at 10 this is a soft limit, enough to stop a runaway client but not a precise global quota.
- Blaze needs a billing account, so cost is bounded only by the instance cap and the budget alert, not by the platform.
- Vendor lock-in: the function is tied to Firebase's runtime and Hosting rewrite, though the handlers are plain functions that could move.

**Why Cloud Functions rather than Cloudflare Workers**

The API first ran as a Cloudflare Worker because Cloud Functions need the paid Blaze plan, which the project did not have. Workers cannot run `firebase-admin`, so the Worker carried hand-written Firebase token verification (`jose`), a Firestore REST client with a service-account token exchange, and a REST-commit retry loop for the registration race, on a second origin that needed CORS and a Content-Security-Policy entry, with no automated tests of its endpoints. Once the project moved to Blaze, Cloud Functions removed all of that: the Admin SDK verifies tokens and talks to Firestore, transactions replace the retry loop, the API is on the site's origin, and the emulator tests run in `npm test`. What was given up is Workers' faster cold start and a free tier that needs no card. The full reasoning is in [docs/adr/0001-api-on-cloud-functions.md](docs/adr/0001-api-on-cloud-functions.md).

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
