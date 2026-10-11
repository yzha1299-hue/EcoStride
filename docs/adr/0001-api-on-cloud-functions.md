# 0001: The API runs on Firebase Cloud Functions, not Cloudflare Workers

**Status:** accepted (October 2026). Supersedes the V3 (D/E) spec decision "Cloudflare Workers are the serverless platform for E.1 (final)".

## Context

EcoStride's server-side logic (registration with the capacity cap, emails, map proxies, AI drafting, the public API) first ran as a Cloudflare Worker. The decision was made for one reason: Firebase Cloud Functions need the paid Blaze plan, and the project did not have one, while Workers' free tier needs no card.

That choice had costs, all of them workarounds for `firebase-admin` not running on Workers:

- Firebase ID tokens were verified by hand-written code (`jose`, Google's public keys, issuer, audience, expiry).
- Firestore was reached through a hand-written REST client, authenticated by exchanging a service-account key for access tokens.
- The registration race (two people taking the last place) was handled with REST commits carrying update-time preconditions and a manual retry loop.
- The browser called the API on a second origin, which needed CORS rules and a build-time Content-Security-Policy entry.
- The Worker's endpoints had no automated tests: their behaviour was checked with throwaway scripts.
- Two platforms (Firebase and Cloudflare) had to be deployed, configured and monitored.

The project has since moved to the Blaze plan, which removes the reason for the original decision.

## Decision

Run the same API as one 2nd-generation Firebase Cloud Function, `api`, in `australia-southeast1` (next to Firestore), served on the site's own origin through a Firebase Hosting rewrite of `/api/**`, using the Firebase Admin SDK.

- Routes, request and response shapes, error codes and behaviour stay the same; the front end changes only its base URL (`/api`). The public API moves to `https://ecostride-82c87.web.app/api/public/v1/...` with no redirect from the old Worker address.
- The function runs as a dedicated service account (`ecostride-api`) that can only use Firestore (Cloud Datastore User), with no key file. Secrets (Brevo, OpenRouteService, Gemini, public API keys) are in Secret Manager and bound to the function; plain settings are function parameters.
- A `maxInstances` cap and a Google Cloud billing budget with alerts limit what a traffic spike or abuse can cost.
- After the new API was verified in production, the Worker, its service-account key and its secrets were removed.

## Consequences

**Better**

- The Admin SDK verifies ID tokens and reads and writes Firestore. The hand-written token verification, REST client and token exchange are gone, so security-critical code is maintained by Firebase.
- Registration and the daily limits are Firestore transactions: Firestore runs transactions on the same document one after another, so the capacity cap holds without a manual retry loop. The race is now an automated test.
- One platform for hosting, auth, database and API: one deploy, one place for logs and secrets.
- Same origin: no CORS preflight, no second connection, no CORS rules for the app's own API, and no API host in the Content-Security-Policy.
- The API is covered by integration tests on the Firebase emulators (Functions, Firestore, Auth) with real ID tokens: refusals, the capacity race, permissions, the public API's exact fields, headers and rate limit. These run in `npm test`.

**Worse, or to watch**

- Cold starts are slower than on Workers (a container starts rather than an isolate). `minInstances` stays at 0, so the first request after idle is slower.
- Blaze needs a billing account. The free tiers (invocations, Secret Manager versions, Cloud Build and Artifact Registry storage for function images) are expected to cover this app, but something that could incur cost exists where there was none; the budget alert is the guard.
- Memory caches (maps, public API) and the Nominatim one-request-per-second throttle are per instance, as they were on Workers. With a low `maxInstances` this is closer to global than before, but it is not global.
- Firebase Hosting applies the `firebase.json` header rules to rewritten function responses. The rule that makes the app shell `no-cache` also matches the public API's events routes, so those answer `Cache-Control: no-cache` instead of the function's own `private, max-age=60`. That is just as safe (no shared cache serves one caller's response to another); only the OpenAPI document keeps the function's value.
- Public Overpass servers are often overloaded or refuse connections from cloud hosting, so nearby-facility lookups try several servers in turn.

## Rollback

During the move the front end could be switched back by rebuilding with `VITE_API_BASE_URL` set to the Worker's address (the Content-Security-Policy adds a full-URL API origin automatically) and redeploying Hosting. This was rehearsed before the Worker was removed. With the Worker gone, a rollback means redeploying an earlier Hosting release and function version from Firebase.
