// The origin to allow in the Content-Security-Policy's connect-src for the
// API, from VITE_API_BASE_URL. Normally the API is on the site's own origin
// (`/api`), which 'self' already covers, so nothing is added. Only a full
// http(s) URL (an API on a separate host) is named - by its origin
// alone, so nothing in the value can add other sources to the policy.
export function apiOriginForCsp(baseUrl) {
  try {
    const url = new URL(baseUrl ?? '')
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : ''
  } catch {
    return ''
  }
}
