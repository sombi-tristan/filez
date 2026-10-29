/**
 * @supabase/supabase-js and @supabase/ssr, for server code in the Node runtime, when
 * DATA_SOURCE=json (next.config.mjs). Queries run in this process against ./engine.js.
 */
import { createJsonClient, SESSION_COOKIE, SESSION_MAX_AGE } from './client'
import { query, auth, storage } from './engine'

function transport({ kind, op, action, args, token }) {
  if (kind === 'query') return Promise.resolve(query(op))
  if (kind === 'auth') return Promise.resolve(auth(action, args, token))
  if (args?.body != null && typeof args.body === 'string') args = { ...args, body: Buffer.from(args.body, 'base64') }
  return Promise.resolve(storage(action, args))
}

const bearerFrom = (options) => {
  const header = options?.global?.headers?.Authorization || options?.global?.headers?.authorization || ''
  return header.match(/^Bearer\s+(\S+)$/i)?.[1] || null
}

/** A client that keeps its session in memory: route handlers that sign in and read the token. */
export function createClient(_url, _key, options = {}) {
  let token = bearerFrom(options)
  return createJsonClient({
    transport,
    session: {
      get: () => token,
      set: (s) => { token = s.access_token },
      clear: () => { token = null },
    },
  })
}

/** @supabase/ssr's server client: the session lives in the jsondb-auth cookie. */
export function createServerClient(_url, _key, { cookies } = {}) {
  let token = null
  const fromCookie = () => {
    try { return (cookies?.getAll?.() || []).find((c) => c.name === SESSION_COOKIE)?.value || null } catch { return null }
  }
  const write = (value, maxAge) => {
    try { cookies?.setAll?.([{ name: SESSION_COOKIE, value, options: { path: '/', sameSite: 'lax', httpOnly: false, maxAge } }]) } catch {}
  }
  return createJsonClient({
    transport,
    session: {
      get: () => token || fromCookie(),
      set: (s) => { token = s.access_token; write(s.access_token, SESSION_MAX_AGE) },
      clear: () => { token = null; write('', 0) },
    },
  })
}

/** Rendered on the server for a client component; it has no session there. */
export function createBrowserClient(url, key) {
  return createClient(url, key)
}
