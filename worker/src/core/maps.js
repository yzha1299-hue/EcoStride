import { ApiError } from './errors.js'
import { createMemoryCache } from './memoryCache.js'
import { fetchUpstream } from './upstream.js'

// Place search (OpenStreetMap Nominatim), walking/cycling directions
// (OpenRouteService) and nearby facilities (Overpass API), called from the
// Worker so the ORS key never reaches the browser and each service's usage
// policy can be respected in one place.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const ORS_URL = 'https://api.openrouteservice.org/v2/directions'
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

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
const nearbyCache = createMemoryCache({ ttlMs: 24 * 60 * 60 * 1000 })
// Lookups already on their way to Overpass, so identical requests share one.
const nearbyInFlight = new Map()

// OpenStreetMap amenity tag -> the category the app shows.
const AMENITY_CATEGORIES = {
  bicycle_parking: 'bikeParking',
  drinking_water: 'drinkingWater',
  toilets: 'toilets',
}
export const NEARBY_RADIUS_M = 500
const MAX_PLACES = 200

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

  // Bike parking, drinking water and toilets within 500 m of a point, or of
  // the straight line between two points (Overpass "around" accepts a line).
  async function nearby(points) {
    if (!userAgent) throw unavailable()
    const coordinates = points.flatMap(({ lat, lng }) => [round(lat), round(lng)])
    const key = coordinates.join(',')
    const cached = nearbyCache.get(key)
    if (cached) return cached
    if (!nearbyInFlight.has(key)) {
      nearbyInFlight.set(
        key,
        queryOverpass(coordinates)
          .then((places) => {
            nearbyCache.set(key, places)
            return places
          })
          .finally(() => nearbyInFlight.delete(key)),
      )
    }
    return nearbyInFlight.get(key)
  }

  async function queryOverpass(coordinates) {
    // One statement matching all three amenity values: about 3x faster on
    // Overpass than a separate "around" search per type.
    const amenities = Object.keys(AMENITY_CATEGORIES).join('|')
    const query =
      `[out:json][timeout:20];` +
      `nwr(around:${NEARBY_RADIUS_M},${coordinates.join(',')})["amenity"~"^(${amenities})$"];` +
      `out center ${MAX_PLACES};`
    const response = await fetchUpstream(
      'The nearby places service',
      OVERPASS_URL,
      {
        method: 'POST',
        headers: { 'User-Agent': userAgent, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
      },
      // 429/504: the public Overpass server is rationing its capacity (it
      // limits requests per IP, and Workers share IPs). Not our fault, not
      // permanent - say so rather than "returned an error".
      { timeoutMs: 20000, allowStatuses: [429, 504] },
    )
    const busy = () =>
      new ApiError(503, 'GEO_BUSY', 'The nearby places service is busy right now. Please try again in a minute.')
    if (!response.ok) throw busy()
    const result = await response.json()
    // A query that runs out of time on the server still comes back as 200,
    // with a "runtime error" remark instead of results.
    if (!result.elements?.length && /runtime error/i.test(result.remark ?? '')) throw busy()
    return result.elements
      .map((element) => {
        const tags = element.tags ?? {}
        // Nodes have a position; ways and relations get their centre.
        const lat = element.lat ?? element.center?.lat
        const lng = element.lon ?? element.center?.lon
        const category = AMENITY_CATEGORIES[tags.amenity]
        if (!category || lat === undefined || lng === undefined) return null
        return {
          id: `${element.type}/${element.id}`,
          category,
          lat: round(lat),
          lng: round(lng),
          name: tags.name ?? null,
          // A few details worth showing, when OpenStreetMap has them.
          capacity: tags.capacity ? Number(tags.capacity) || null : null,
          wheelchair: tags.wheelchair ?? null,
          fee: tags.fee ?? null,
        }
      })
      .filter(Boolean)
  }

  return { searchPlaces, directions, nearby }
}
