// API keys for the public API, kept in the PUBLIC_API_KEYS Worker secret as
// comma-separated `name:key` pairs, e.g. "demo:3f9a...,council-widget:81c2...".
// The name identifies the caller in logs and rate limits; the key itself is
// never logged. Issuing or revoking a key is just editing the secret.
export function parseApiKeys(secret) {
  return (secret ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const colon = entry.indexOf(':')
      return colon > 0 ? { name: entry.slice(0, colon), key: entry.slice(colon + 1) } : null
    })
    .filter((entry) => entry && entry.key)
}

// Compares in time that depends only on the lengths, not on how many leading
// characters match, so response timing can't be used to guess a key.
function sameText(a, b) {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let difference = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    difference |= (x[i] ?? 0) ^ (y[i] ?? 0)
  }
  return difference === 0
}

// The name of the key presented, or null. Every key is compared, so the time
// taken doesn't reveal which one nearly matched.
export function findApiKey(keys, presented) {
  if (!presented) return null
  let found = null
  for (const { name, key } of keys) {
    if (sameText(key, presented)) found = name
  }
  return found
}

// Fixed-window counter per key name: at most `limit` requests per window.
// Kept in the isolate's memory (like the other Worker caches), so it limits
// each isolate rather than being exactly global - enough to stop a runaway
// client from exhausting the Worker and Firestore quotas.
export function createRateLimiter({ limit, windowMs, maxKeys = 1000 }) {
  const windows = new Map()

  function check(name, now = Date.now()) {
    let window = windows.get(name)
    if (!window || now - window.start >= windowMs) {
      if (!window && windows.size >= maxKeys) windows.clear()
      window = { start: now, count: 0 }
      windows.set(name, window)
    }
    if (window.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((window.start + windowMs - now) / 1000))
      return { allowed: false, remaining: 0, retryAfterSeconds }
    }
    window.count += 1
    return { allowed: true, remaining: limit - window.count }
  }

  return { check }
}
