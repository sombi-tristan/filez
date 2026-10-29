/**
 * @supabase/supabase-js and @supabase/ssr, for the browser and the Edge middleware, when
 * DATA_SOURCE=json (next.config.mjs). Neither can read files, so every call is posted to
 * app/api/jsondb, which runs it against ./engine.js.
 *
 * In the browser the session is the jsondb-auth cookie that route sets; the middleware passes
 * the cookie's value along itself, since its fetch carries no cookies.
 *
 * The Android app (`npm run build:android:json`) is served from the phone, so it posts to
 * NEXT_PUBLIC_API_ORIGIN, the PC running `npm run dev:json`. No cookie crosses that gap, so the
 * browser client keeps its token in localStorage and sends it with every call. The address is
 * absolute, which also keeps lib/appFetch.js from rerouting it and asking this client for a
 * session to sign it with, from inside that very call.
 */
import { createJsonClient, SESSION_COOKIE } from './client'

const inBrowser = typeof window !== 'undefined'

// The middleware runs on the server with no page origin to be relative to.
const ORIGIN = inBrowser ? process.env.NEXT_PUBLIC_API_ORIGIN || '' : process.env.JSONDB_ORIGIN || 'http://localhost:3000'

async function transport(request) {
  try {
    const res = await fetch(`${ORIGIN}/api/jsondb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(request),
      cache: 'no-store',
    })
    return await res.json()
  } catch (err) {
    return { data: null, error: { message: `JSON datastore unreachable: ${err.message}`, code: 'JSONDB' } }
  }
}

function memorySession(initial = null) {
  let token = initial
  return {
    get: () => token,
    set: (s) => { token = s.access_token },
    clear: () => { token = null },
  }
}

export function createClient(_url, _key, options = {}) {
  const header = options?.global?.headers?.Authorization || options?.global?.headers?.authorization || ''
  return createJsonClient({ transport, session: memorySession(header.match(/^Bearer\s+(\S+)$/i)?.[1] || null) })
}

/** The browser's client: the token in localStorage, and on the website the cookie as well. */
export function createBrowserClient() {
  const read = () => { try { return localStorage.getItem(SESSION_COOKIE) } catch { return null } }
  const write = (value) => {
    try { value ? localStorage.setItem(SESSION_COOKIE, value) : localStorage.removeItem(SESSION_COOKIE) } catch {}
  }
  return createJsonClient({
    transport,
    session: {
      get: () => read(),
      set: (s) => write(s.access_token),
      clear: () => write(null),
    },
  })
}

/** The middleware's client: it reads the session from the request's cookies. */
export function createServerClient(_url, _key, { cookies } = {}) {
  let token = null
  const fromCookie = () => {
    try { return (cookies?.getAll?.() || []).find((c) => c.name === SESSION_COOKIE)?.value || null } catch { return null }
  }
  return createJsonClient({
    transport,
    session: {
      get: () => token || fromCookie(),
      set: (s) => { token = s.access_token },
      clear: () => { token = null },
    },
  })
}
