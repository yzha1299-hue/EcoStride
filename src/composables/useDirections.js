import { ref } from 'vue'
import { geoDirections } from '../api/client'
import { profileForMode } from '../utils/geo'

export const GEOLOCATION_ERRORS = {
  1: "Location access is turned off for this site. You can allow it in your browser's settings, or type a place instead.",
  2: "Your location isn't available right now. Type a place instead.",
  3: 'Finding your location took too long. Try again, or type a place instead.',
}

// The browser's location as { lat, lng, label }, or a rejection whose `code`
// indexes GEOLOCATION_ERRORS.
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(Object.assign(new Error('unsupported'), { code: 2 }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude, label: 'Your location' }),
      reject,
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    )
  })
}

// Walking/cycling directions between two places, shared by Active Travel
// (to a trail's start) and the events map (to a venue). Tracks loading, a
// "slow" flag after 5 s and a user-facing error message.
export function useDirections() {
  const trip = ref(null)
  const loading = ref(false)
  const slow = ref(false)
  const error = ref('')

  function clear() {
    trip.value = null
    error.value = ''
  }

  // `from`/`to`: { lat, lng, label }; `mode`: 'Walk' | 'Cycle' | 'Micro-mobility'.
  // `toDescription` completes "Walking from X to ...", e.g. "the venue".
  async function load({ from, to, mode, toDescription }) {
    error.value = ''
    loading.value = true
    slow.value = false
    const slowTimer = setTimeout(() => {
      slow.value = true
    }, 5000)
    try {
      const result = await geoDirections({ from, to, profile: profileForMode(mode) })
      trip.value = { ...result, mode, fromLabel: from.label, toLabel: to.label, toDescription }
      return true
    } catch (directionsError) {
      error.value = directionsError.message
      return false
    } finally {
      clearTimeout(slowTimer)
      loading.value = false
      slow.value = false
    }
  }

  return { trip, loading, slow, error, load, clear }
}
