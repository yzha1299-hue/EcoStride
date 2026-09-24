import { ApiError } from './errors.js'
import { createMemoryCache } from './memoryCache.js'
import { fetchUpstream } from './upstream.js'

// Place search (OpenStreetMap Nominatim) and walking/cycling directions
// (OpenRouteService), called from the Worker so the ORS key never reaches the
// browser and Nominatim's usage policy can be respected in one place.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const ORS_URL = 'https://api.openrouteservice.org/v2/directions'

// Nominatim allows at most 1 request per second and asks for an identifying
// User-Agent. Requests from this isolate are spaced 1 s apart; anyone who would
// wait more than a few seconds is told to try again instead.
const NOMINATIM_GAP_MS = 1000
const MAX_WAIT_MS = 3000
let nextNominatimSlot = 0

// Victoria's bounding box, so "Richmond" finds Melbourne's, not the one in NSW.
const VICTORIA_VIEWBOX = '140.9,-39.2,150.0,-33.9'

export const PROFILES = ['foot-walking', 'cycling-regular']

// Places barely move and trails don't change, so results keep for a while.
const searchCache = createMemoryCache({ ttlMs: 7 * 24 * 60 * 60 * 1000 })
const directionsCache = createMemoryCache({ ttlMs: 24 * 60 * 60 * 1000 })

// ~1 m precision: enough for directions and keeps cache keys stable.
const round = (value) => Math.round(value * 1e5) / 1e5

const unavailable = () => new ApiError(503, 'GEO_UNAVAILABLE', "Maps aren't set up on the server yet.")

async function waitForNominatimSlot() {
  const now = Date.now()
  const slot = Math.max(now, nextNominatimSlot)
  if (slot - now > MAX_WAIT_MS) {
    throw new ApiError(503, 'GEO_BUSY', 'Lots of people are searching right now. Please try again in a few seconds.')
  }
  nextNominatimSlot = slot + NOMINATIM_GAP_MS
  if (slot > now) {
    await new Promise((resolve) => setTimeout(resolve, slot - now))
  }
}

export function createMapServices({ orsApiKey, userAgent }) {
  // Up to 5 places in Victoria matching free text, e.g. "Footscray 3011".
  async function searchPlaces(query) {
    if (!userAgent) throw unavailable()
    const key = query.toLowerCase().replace(/\s+/g, ' ')
    const cached = searchCache.get(key)
    if (cached) return cached

    await waitForNominatimSlot()
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      countrycodes: 'au',
      viewbox: VICTORIA_VIEWBOX,
      bounded: '1',
      limit: '5',
    })
    const response = await fetchUpstream('The place search service', `${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
    })
    const places = (await response.json()).map((place) => ({
      label: place.display_name,
      lat: round(Number(place.lat)),
      lng: round(Number(place.lon)),
    }))
    searchCache.set(key, places)
    return places
  }

  // Route between two points: its line ([lat, lng] pairs), length in metres,
  // time in seconds and turn-by-turn steps.
  async function directions({ from, to, profile }) {
    if (!orsApiKey) throw unavailable()
    const coordinates = [
      [round(from.lng), round(from.lat)],
      [round(to.lng), round(to.lat)],
    ]
    const key = `${profile}:${coordinates.flat().join(',')}`
    const cached = directionsCache.get(key)
    if (cached) return cached

    const response = await fetchUpstream(
      'The directions service',
      `${ORS_URL}/${profile}/geojson`,
      {
        method: 'POST',
        headers: {
          Authorization: orsApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json, application/geo+json',
        },
        body: JSON.stringify({ coordinates, instructions: true, units: 'm', language: 'en' }),
      },
      // 4xx here means ORS understood but found no route (e.g. a point far
      // from any path), which deserves its own message.
      { allowStatuses: [400, 404] },
    )
    if (!response.ok) {
      throw new ApiError(
        422,
        'NO_ROUTE',
        "We couldn't find a walking or cycling route between these places. Try a start point closer to a street or path.",
      )
    }

    const feature = (await response.json()).features[0]
    const summary = feature.properties.summary ?? {}
    const route = {
      coordinates: feature.geometry.coordinates.map(([lng, lat]) => [round(lat), round(lng)]),
      distance: Math.round(summary.distance ?? 0),
      duration: Math.round(summary.duration ?? 0),
      steps: (feature.properties.segments ?? [])
        .flatMap((segment) => segment.steps ?? [])
        .map((step) => ({
          instruction: step.instruction,
          distance: Math.round(step.distance),
          duration: Math.round(step.duration),
        })),
    }
    directionsCache.set(key, route)
    return route
  }

  return { searchPlaces, directions }
}
