const EARTH_RADIUS_KM = 6371

// Straight-line ("as the crow flies") distance between two { lat, lng } points.
export function distanceKm(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

// "850 m", "2.4 km"
export function formatDistance(metres) {
  return metres < 1000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`
}

// Directions services have walking and cycling profiles only; scooters and
// other micro-mobility use the cycling one.
export function profileForMode(mode) {
  return mode === 'Walk' ? 'foot-walking' : 'cycling-regular'
}

export const MELBOURNE_CENTRE = { lat: -37.8136, lng: 144.9631 }
