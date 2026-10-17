/**
 * StationMGR Desktop signs people in with their web account (app/api/desktop/sign-in and
 * sign-up): one account on the website and every computer, no PINs. The web checks the email
 * and password; this answers who they are and which stations they may open there, which the
 * computer keeps so the next sign-in works offline.
 *
 * Takes the Supabase clients, so tests/desktop-accounts.test.mjs can pass stand-ins.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MIN_PASSWORD = 6

/**
 * Who a web user is, and their stations: owned ones, and accepted invites with their pages.
 * Returns { user: { id, name, email }, stations: [{ id, name, location, role, visiblePages }] }
 * or { error }.
 */
export async function accountFor(service, userId) {
  const { data: user } = await service.from('users').select('id, name, email').eq('id', userId).maybeSingle()
  if (!user) return { error: 'No StationMGR account for this sign-in' }

  const { data: owned } = await service.from('organizations').select('id, name, location').eq('owner_id', user.id)
  const { data: invites } = await service
    .from('org_invites')
    .select('org_id, visible_pages, organizations(id, name, location)')
    .eq('email', user.email)
    .eq('status', 'accepted')

  const stations = (owned || []).map((s) => ({ id: s.id, name: s.name, location: s.location || '', role: 'owner' }))
  for (const i of invites || []) {
    if (!i.organizations || stations.some((s) => s.id === i.org_id)) continue
    stations.push({ id: i.org_id, name: i.organizations.name, location: i.organizations.location || '', role: 'staff', visiblePages: i.visible_pages || null })
  }
  return { user: { id: user.id, name: user.name || '', email: user.email }, stations }
}

/**
 * Creates a web account as the website's sign-up does (app/auth/register), then checks the
 * password signs in. Returns { userId } or { error }.
 */
export async function signUpWith(anon, { name, email, password }) {
  const cleanName = String(name || '').trim()
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanName) return { error: 'Your name is required' }
  if (!EMAIL.test(cleanEmail)) return { error: 'Enter a valid email address' }
  if (String(password || '').length < MIN_PASSWORD) return { error: `The password needs at least ${MIN_PASSWORD} characters` }

  const { error } = await anon.auth.signUp({ email: cleanEmail, password: String(password), options: { data: { name: cleanName } } })
  if (error) {
    return { error: /already/i.test(error.message || '') ? 'An account with this email already exists. Sign in instead.' : (error.message || 'Could not create the account') }
  }
  const { data, error: signInError } = await anon.auth.signInWithPassword({ email: cleanEmail, password: String(password) })
  // Only this session ends: the default signs the account out everywhere.
  anon.auth.signOut?.({ scope: 'local' }).catch?.(() => {})
  if (signInError || !data?.user) return { error: 'The account was made, but signing in failed. Check your email, then sign in.' }
  return { userId: data.user.id }
}
