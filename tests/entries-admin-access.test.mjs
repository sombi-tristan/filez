/**
 * Pins who may act on /api/entries/*.
 *
 * lib/stationAccess.js was written to be the one place that decides who may act inside a
 * station, and it admits three kinds of caller: owner, accepted member, and platform admin.
 * Every /api/entries/* route, though, still went through authenticateUser() in
 * lib/entryHelpers.js, which knew only the first two and 403'd everyone else.
 *
 * The consequence is the bug this test was written for: an admin onboards a station (the
 * setup wizard uses hasStationAccess, so it works), then opens the entry or report screens
 * for that station. initialSync fetches nozzles/tanks/customers, gets 403 on all of them,
 * throws at the customers check and leaves the local Dexie mirror empty. The setup page is
 * the only screen that still looks right, because it reads from the server.
 *
 * components/AdminViewingBanner.js exists precisely because admins are expected on those
 * screens, so the 403 is the defect, not the banner.
 *
 * Test 3 fails against the pre-fix code. The Supabase client and NextResponse are stubbed so
 * the real query chains run without a database.
 *
 * Run: node tests/entries-admin-access.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load the real source with its imports stripped; every dependency is injected below.
const src = readFileSync(resolve(__dirname, '..', 'lib', 'entryHelpers.js'), 'utf8')
  .replace(/^\s*import[^\n]*\n/gm, '')
  .replace(/^\s*export\s+/gm, '')

const loadModule = (deps) =>
  new Function(
    'NextResponse', 'createClient', 'createServerClient', 'cookies', 'rateLimit', 'isAdmin',
    `${src}\n;return { authenticateUser };`
  )(
    deps.NextResponse, deps.createClient, deps.createServerClient,
    deps.cookies, deps.rateLimit, deps.isAdmin
  )

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

/** Fake Supabase: `rows` maps table -> records; chained .eq() filters, .single() takes the first. */
function fakeClient(rows) {
  return {
    from(table) {
      let set = (rows[table] || []).slice()
      const chain = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        eq(field, value) { set = set.filter((r) => r[field] === value); return chain },
        single: async () => ({ data: set[0] || null, error: set[0] ? null : { message: 'not found' } }),
        maybeSingle: async () => ({ data: set[0] || null, error: null }),
      }
      return chain
    },
  }
}

const ORG = 'org_1'
const OWNER = { id: 'u_owner', email: 'owner@x.com', role: 'user', org_id: ORG }
const STAFF = { id: 'u_staff', email: 'staff@x.com', role: 'user', org_id: null }
const ADMIN = { id: 'u_admin', email: 'admin@x.com', role: 'admin', org_id: 'org_admin_own' }
const STRANGER = { id: 'u_other', email: 'other@x.com', role: 'user', org_id: null }

/**
 * @param authUser  who is logged in (a users row), or null
 * @param rows      table overrides for the fake db
 */
function deps(authUser, rows = {}) {
  const db = {
    users: [OWNER, STAFF, ADMIN, STRANGER],
    organizations: [{ id: ORG, owner_id: OWNER.id }],
    org_invites: [{ id: 'inv_1', org_id: ORG, email: STAFF.email, status: 'accepted' }],
    ...rows,
  }
  return {
    NextResponse: { json: (body, init) => ({ __response: true, body, status: init?.status ?? 200 }) },
    createClient: () => fakeClient(db),
    createServerClient: () => ({
      auth: { getUser: async () => ({ data: { user: authUser } }) },
    }),
    cookies: async () => ({ getAll: () => [], set: () => {} }),
    rateLimit: () => ({ success: true }),
    // The real one: role check only, no I/O.
    isAdmin: (u) => u?.role === 'admin',
  }
}

const request = { url: `http://x/api/entries/nozzles?org_id=${ORG}` }

console.log('\n1. the station owner is admitted')
{
  const mod = loadModule(deps(OWNER))
  const { user, error, via } = await mod.authenticateUser(request)
  check('no error', !error, error ? JSON.stringify(error.body) : '')
  check('org_id resolved to the requested station', user?.org_id === ORG, `org_id=${user?.org_id}`)
  check('via is owner', via === 'owner', `via=${via}`)
}

console.log('\n2. an accepted staff member is admitted')
{
  const mod = loadModule(deps(STAFF))
  const { user, error, via } = await mod.authenticateUser(request)
  check('no error', !error, error ? JSON.stringify(error.body) : '')
  check('org_id resolved to the requested station', user?.org_id === ORG, `org_id=${user?.org_id}`)
  check('via is member', via === 'member', `via=${via}`)
}

console.log('\n3. THE BUG: a platform admin is admitted to a station they do not own')
{
  const mod = loadModule(deps(ADMIN))
  const { user, error, via } = await mod.authenticateUser(request)
  check('not rejected', !error, error ? `status=${error.status} ${JSON.stringify(error.body)}` : '')
  check('org_id points at the station asked for, not the admin own', user?.org_id === ORG, `org_id=${user?.org_id}`)
  check('via is admin, so the write can be logged as an assist', via === 'admin', `via=${via}`)
}

console.log('\n4. an unrelated user is still refused')
{
  const mod = loadModule(deps(STRANGER))
  const { user, error } = await mod.authenticateUser(request)
  check('rejected with 403', error?.status === 403, `status=${error?.status}`)
  check('no user returned', !user)
}

console.log('\n5. a station that does not exist is still 404, for everyone')
{
  const mod = loadModule(deps(ADMIN, { organizations: [] }))
  const { error } = await mod.authenticateUser(request)
  check('admin gets 404, not access to nothing', error?.status === 404, `status=${error?.status}`)
}

console.log('\n6. no session is still 401')
{
  const mod = loadModule(deps(null))
  const { error } = await mod.authenticateUser(request)
  check('rejected with 401', error?.status === 401, `status=${error?.status}`)
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
