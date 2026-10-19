/**
 * Sends the Android app's `/api/*` requests to the site.
 *
 * The app carries the screens as files (npm run build:android) and is served from the phone
 * (https://localhost), where there is no API. The screens call fetch('/api/...') in many places,
 * so rather than rewrite each of them, fetch itself is wrapped once: an /api request on the
 * app's own origin goes to NEXT_PUBLIC_API_ORIGIN instead, and everything else is untouched.
 *
 * NEXT_PUBLIC_API_ORIGIN is set only by the Android build (next.config.mjs), so on the website
 * this does nothing. Imported for its side effect, first thing in the client bundle
 * (components/AppShell.js).
 */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN

/** The site's address for an /api request on the app's own origin, or null for anything else. */
export function apiUrlFor(input, here = window.location.href) {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url
  if (!raw) return null
  const url = new URL(raw, here)
  if (url.origin !== new URL(here).origin || !url.pathname.startsWith('/api/')) return null
  return `${API_ORIGIN}${url.pathname}${url.search}`
}

if (API_ORIGIN && typeof window !== 'undefined' && !window.__appFetchInstalled) {
  window.__appFetchInstalled = true
  const appFetch = window.fetch.bind(window)

  window.fetch = (input, init) => {
    const target = apiUrlFor(input)
    if (!target) return appFetch(input, init)
    // A Request keeps its method, headers and body when copied to the new address.
    return appFetch(input instanceof Request ? new Request(target, input) : target, init)
  }
}
