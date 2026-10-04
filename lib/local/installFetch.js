import { matchRoute } from './router'

/**
 * Answers `/api/*` requests inside the app instead of over the network.
 *
 * The screens were written against a server and call fetch('/api/...') in many places. Rather
 * than rewrite each of them, fetch itself is wrapped once: an /api request is handed to the
 * matching route handler (lib/local/routes, the original server code running against the local
 * store) and its Response comes straight back. Everything else goes to the real fetch, which in
 * the desktop app can only reach the app's own bundled files.
 *
 * Imported for its side effect, first thing in the client bundle (components/AppShell.js).
 */
const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function handle(url, input, init) {
  const route = matchRoute(url.pathname)
  if (!route) return json({ error: `No such endpoint: ${url.pathname}` }, 404)

  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
  // Routes only read the path and query from request.url; a plain http URL keeps Request happy
  // whatever scheme the app itself is served from.
  const request = input instanceof Request && !init
    ? new Request(`http://localhost${url.pathname}${url.search}`, input)
    : new Request(`http://localhost${url.pathname}${url.search}`, { ...init, method })

  const mod = await route.load()
  const handler = mod[method]
  if (!handler) return json({ error: 'Method not allowed' }, 405)

  try {
    return await handler(request, { params: Promise.resolve(route.params) })
  } catch (e) {
    console.error(`[local api] ${method} ${url.pathname}`, e)
    return json({ error: 'Server error' }, 500)
  }
}

if (typeof window !== 'undefined' && !window.__localApiInstalled) {
  window.__localApiInstalled = true
  const realFetch = window.fetch.bind(window)

  window.fetch = function localFetch(input, init) {
    let url
    try {
      const raw = input instanceof Request ? input.url : String(input)
      url = new URL(raw, window.location.href)
    } catch {
      return realFetch(input, init)
    }
    if (url.origin === window.location.origin && url.pathname.startsWith('/api/')) {
      return handle(url, input, init)
    }
    return realFetch(input, init)
  }
}
