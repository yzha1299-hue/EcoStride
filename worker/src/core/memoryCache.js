// A small time-limited cache kept in the Worker isolate's memory. Cloudflare's
// Cache API does nothing on *.workers.dev domains, so this is what lets
// repeated map lookups skip the upstream service. Each isolate has its own
// copy and loses it when recycled - fine for data that is cheap to refetch.
export function createMemoryCache({ maxEntries = 200, ttlMs }) {
  const entries = new Map()

  function get(key) {
    const entry = entries.get(key)
    if (!entry) return undefined
    if (entry.expires < Date.now()) {
      entries.delete(key)
      return undefined
    }
    // Re-insert so the Map's order tracks recent use (oldest first).
    entries.delete(key)
    entries.set(key, entry)
    return entry.value
  }

  function set(key, value) {
    entries.delete(key)
    entries.set(key, { value, expires: Date.now() + ttlMs })
    if (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value)
    }
  }

  return { get, set }
}
