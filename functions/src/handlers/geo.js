import { NEARBY_RADIUS_M, PROFILES } from '../core/maps.js'

// Map lookups for Active Travel and the events map. They need a signed-in
// caller, so the directions quota and Nominatim's goodwill can't be drained by
// scripts elsewhere; the work itself lives in core/maps.js.
export const geoSearchSchema = {
  query: { type: 'string', required: true, maxLength: 200 },
}

export async function geoSearch({ body, deps }) {
  return { places: await deps.maps.searchPlaces(body.query) }
}

const LAT = { type: 'number', required: true, min: -90, max: 90 }
const LNG = { type: 'number', required: true, min: -180, max: 180 }

export const geoDirectionsSchema = {
  fromLat: LAT,
  fromLng: LNG,
  toLat: LAT,
  toLng: LNG,
  profile: { type: 'string', required: true, maxLength: 20, pattern: new RegExp(`^(${PROFILES.join('|')})$`) },
}

export const geoNearbySchema = {
  lat: LAT,
  lng: LNG,
  // Optional second point: search along the line between the two.
  endLat: { ...LAT, required: false },
  endLng: { ...LNG, required: false },
}

export async function geoNearby({ body, deps }) {
  const points = [{ lat: body.lat, lng: body.lng }]
  if (body.endLat !== undefined && body.endLng !== undefined) {
    points.push({ lat: body.endLat, lng: body.endLng })
  }
  return { radiusMetres: NEARBY_RADIUS_M, places: await deps.maps.nearby(points) }
}

export async function geoDirections({ body, deps }) {
  return deps.maps.directions({
    from: { lat: body.fromLat, lng: body.fromLng },
    to: { lat: body.toLat, lng: body.toLng },
    profile: body.profile,
  })
}
