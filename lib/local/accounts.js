import { store } from './store'
import { webAccount } from './web'
import { hashPin, checkPin } from './pin'
import { setSessionUserId } from './session'

/**
 * Signing in on StationMGR Desktop with the web account: one account on the website and every
 * computer, no PINs (app/api/desktop/sign-in and sign-up on the web).
 *
 * Online, the web checks the email and password and says which stations the person owns or was
 * invited to. The computer keeps the person (users, marked web_account) with its own check of
 * the password (a bcrypt hash in pin_hash, never the password), so the next sign-in works
 * offline. A password the web refuses is refused here too, so one changed on the web takes over
 * at the next sign-in online. Pinned by tests/desktop-web-sign-in.test.mjs.
 */

const clean = (email) => String(email || '').trim().toLowerCase()
const UNREACHABLE = (res) => !res || res.status === 0

/** Keeps the person the web answered with, and opens their stations that are on this computer. */
async function remember({ user, stations }, password) {
  const here = await store.users.get(user.id)
  await store.users.put({
    ...(here || { created_at: new Date().toISOString() }),
    id: user.id,
    email: clean(user.email),
    name: user.name || user.email,
    role: here?.role || 'user',
    pin_hash: await hashPin(password),
    web_account: true,
    disabled: false,
  })
  for (const s of stations || []) {
    const station = await store.organizations.get(s.id)
    if (!station) continue
    if (s.role === 'owner') {
      // The web says they own it: so they do here, whoever held it under an old PIN account.
      if (station.owner_id !== user.id) await store.organizations.put({ ...station, owner_id: user.id })
      continue
    }
    const invites = await store.org_invites.where('org_id').equals(s.id).toArray()
    const mine = invites.find((i) => clean(i.email) === clean(user.email))
    await store.org_invites.put({
      ...(mine || { id: crypto.randomUUID(), invited_at: new Date().toISOString() }),
      org_id: s.id,
      email: clean(user.email),
      status: 'accepted',
      responded_at: mine?.responded_at || new Date().toISOString(),
      ...(s.visiblePages ? { visible_pages: s.visiblePages } : {}),
    })
  }
}

/** Signs in: { ok } or { ok: false, error }. */
export async function signIn({ email, password }) {
  const address = clean(email)
  if (!address || !password) return { ok: false, error: 'Enter your email and password' }

  const res = await webAccount('/api/desktop/sign-in', { email: address, password })
  if (res.ok) {
    await remember(res.body, password)
    setSessionUserId(res.body.user.id)
    return { ok: true }
  }
  if (!UNREACHABLE(res)) return { ok: false, error: res.body?.error || 'Could not sign in' }

  // Offline: the check this computer kept from the last sign-in online.
  const known = (await store.users.toArray()).find((u) => u.web_account && clean(u.email) === address && !u.disabled)
  if (!known) return { ok: false, error: 'You need the internet to sign in on this computer for the first time.' }
  if (!(await checkPin(password, known.pin_hash))) return { ok: false, error: 'Wrong email or password' }
  setSessionUserId(known.id)
  return { ok: true }
}

/** Creates a web account (online only) and signs in with it: { ok } or { ok: false, error }. */
export async function signUp({ name, email, password }) {
  const res = await webAccount('/api/desktop/sign-up', { name, email: clean(email), password })
  if (UNREACHABLE(res)) return { ok: false, error: 'Creating an account needs the internet.' }
  if (!res.ok) return { ok: false, error: res.body?.error || 'Could not create the account' }
  await remember(res.body, password)
  setSessionUserId(res.body.user.id)
  return { ok: true }
}
