# EcoStride public events API

Read-only REST API for partners - councils, community sites, club websites - to show EcoStride's upcoming active-travel and sustainability events in Melbourne. It exposes events only: never names, emails, accessibility needs or anything else about the people who register.

- **Base URL:** `https://ecostride-api.ecostride.workers.dev`
- **Format:** JSON (UTF-8). Times are ISO 8601 in UTC.
- **Machine-readable spec:** [`GET /public/v1/openapi.json`](https://ecostride-api.ecostride.workers.dev/public/v1/openapi.json) (OpenAPI 3; no key needed) - import it into Postman, Insomnia or Swagger Editor.

## Authentication

Every request (except the OpenAPI document) needs an API key in the `X-API-Key` header:

```
X-API-Key: <your key>
```

Keys are issued by EcoStride staff; ask the team for one. Keep it out of public source code where you can; it identifies you in our logs and can be revoked.

## Rate limits

60 requests per minute per key. Every response includes `X-RateLimit-Remaining`. Over the limit you get `429 Too Many Requests` with a `Retry-After` header (seconds). Responses may be cached for 60 seconds (`Cache-Control: public, max-age=60`), so polling more often than once a minute gains nothing.

## Endpoints

### `GET /public/v1/events`

Upcoming events (not yet ended), soonest first. Cancelled events are included with `"state": "cancelled"` so you can take them down.

| Query parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `type` | string | - | Only this event type, case-insensitive (e.g. `Workshop`, `Active travel`, `Club session`). |
| `limit` | integer 1-50 | 20 | Maximum number of events returned. |

Any other query parameter is rejected with `400 INVALID_REQUEST`, so typos don't pass silently.

Response `200`:

```json
{
  "data": [ { "...": "event, see below" } ],
  "count": 1,
  "total": 6,
  "generatedAt": "2026-09-28T04:12:09.000Z"
}
```

`count` is the number of events in `data`; `total` is how many matched before `limit` was applied.

### `GET /public/v1/events/{id}`

One event, with live places left and state. Response `200`: `{ "data": { ...event }, "generatedAt": "..." }`. Unknown id: `404 NOT_FOUND`.

## The event object

```json
{
  "id": "bike-maintenance",
  "title": "Bike maintenance basics",
  "type": "Workshop",
  "description": "Fix a flat and adjust brakes.",
  "venue": "Brunswick Town Hall",
  "address": "233 Sydney Rd, Brunswick VIC 3056",
  "location": { "lat": -37.7667, "lng": 144.9606 },
  "startsAt": "2026-10-10T00:00:00.000Z",
  "endsAt": "2026-10-10T02:00:00.000Z",
  "timezone": "Australia/Melbourne",
  "capacity": 16,
  "placesLeft": 11,
  "state": "open",
  "access": ["Wheelchair accessible"],
  "clubName": "Carlton Cycling Club",
  "url": "https://ecostride-82c87.web.app/events"
}
```

| Field | Notes |
| --- | --- |
| `location` | Venue coordinates, or `null` if the organiser hasn't set a map location. |
| `startsAt`, `endsAt` | UTC. Show them in `timezone` (Melbourne), e.g. `new Date(startsAt).toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' })`. |
| `state` | `open` (can register), `full`, `closed` (already started), `cancelled`. |
| `placesLeft` | Places still available (0 when full). |
| `url` | Where people register on EcoStride. |

## Errors

Errors have a status code and a JSON body:

```json
{ "error": { "code": "API_KEY_INVALID", "message": "That API key is not valid." } }
```

| Status | `code` | When |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Unknown query parameter, or `limit` out of range. |
| 401 | `API_KEY_MISSING` | No `X-API-Key` header. |
| 401 | `API_KEY_INVALID` | The key isn't recognised (or was revoked). |
| 404 | `NOT_FOUND` | No event with that id, or no such endpoint. |
| 405 | `METHOD_NOT_ALLOWED` | Anything other than `GET` (the API is read-only). |
| 429 | `RATE_LIMITED` | Over 60 requests a minute; wait `Retry-After` seconds. |
| 500 / 502 / 504 | `INTERNAL`, `UPSTREAM_ERROR`, `UPSTREAM_TIMEOUT` | Our side; try again shortly. |

## Examples

curl:

```sh
curl -H "X-API-Key: $ECOSTRIDE_KEY" \
  "https://ecostride-api.ecostride.workers.dev/public/v1/events?type=workshop&limit=5"

curl -H "X-API-Key: $ECOSTRIDE_KEY" \
  "https://ecostride-api.ecostride.workers.dev/public/v1/events/bike-maintenance"
```

JavaScript (browser or Node 18+) - the API allows requests from any website:

```js
const response = await fetch('https://ecostride-api.ecostride.workers.dev/public/v1/events?limit=5', {
  headers: { 'X-API-Key': ECOSTRIDE_KEY },
})
if (!response.ok) {
  const { error } = await response.json()
  throw new Error(`${error.code}: ${error.message}`)
}
const { data } = await response.json()
for (const event of data) {
  const when = new Date(event.startsAt).toLocaleString('en-AU', { timeZone: event.timezone })
  console.log(`${event.title} - ${when} - ${event.placesLeft} places left`)
}
```

## For EcoStride staff: issuing and revoking keys

Keys live in the Worker secret `PUBLIC_API_KEYS` as comma-separated `name:key` pairs, e.g. `demo:3f9a...,council-widget:81c2...`. The name appears in logs and rate limits; the key is never logged.

```sh
# a new random key (PowerShell)
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
# then set the whole list again, including existing keys you want to keep
cd worker
npx wrangler secret put PUBLIC_API_KEYS
```

To revoke a key, set the secret again without it. Changes apply within seconds; no redeploy needed.
