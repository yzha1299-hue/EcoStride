const EARTH_RADIUS_KM = 6371

// Straight-line ("as the crow flies") distance between two { lat, lng } points.
export function distanceKm(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

// "40 m", "850 m", "2.4 km"
export function formatDistance(metres) {
  if (metres >= 995) return `${(metres / 1000).toFixed(1)} km`
  if (metres < 100) return `${Math.round(metres)} m`
  return `${Math.round(metres / 10) * 10} m`
}

// Directions services have walking and cycling profiles only; scooters and
// other micro-mobility use the cycling one.
export function profileForMode(mode) {
  return mode === 'Walk' ? 'foot-walking' : 'cycling-regular'
}

export const MELBOURNE_CENTRE = { lat: -37.8136, lng: 144.9631 }

// "45 s", "12 min", "1 h 5 min"
export function formatDuration(seconds) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

// Nearby facility types: label, and the colour and letter used for both map
// markers and the toggles' legend, so they're told apart without colour alone.
// Colours keep white text at WCAG AA contrast.
export const AMENITY_STYLES = {
  bikeParking: { label: 'Bike parking', letter: 'P', color: '#0b5ed7' },
  drinkingWater: { label: 'Drinking water', letter: 'W', color: '#087990' },
  toilets: { label: 'Toilets', letter: 'T', color: '#a14a00' },
}
