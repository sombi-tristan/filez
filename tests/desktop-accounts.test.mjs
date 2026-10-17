/**
 * Pins how StationMGR Desktop signs people in with their web account (lib/desktopAccount.js,
 * used by app/api/desktop/sign-in and sign-up): the web checks the email and password, and
 * answers who they are and which stations they own or were invited to, with their pages.
 *
 * Stand-ins for the Supabase clients record what is asked, so no database is needed.
 *
 * Run: node tests/desktop-accounts.test.mjs
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { accountFor, signUpWith } = await import(pathToFileURL(resolve(__dirname, '..', 'lib', 'desktopAccount.js')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

// A stand-in for the service client: tables of rows, filtered by eq().
function serviceDb(tables) {
  return {
    from(table) {
      const filters = []
      const api = {
        select() { return api },
        eq(col, val) { filters.push([col, val]); return api },
        order() { return api },
        rows() { return (tables[table] || []).filter((r) => filters.every(([c, v]) => r[c] === v)) },
        async maybeSingle() { return { data: api.rows()[0] || null } },
        then(resolve) { return Promise.resolve({ data: api.rows() }).then(resolve) },
      }
      return api
    },
  }
}

const db = serviceDb({
  users: [{ id: 'u1', name: 'Destiny', email: 'destiny@example.com' }, { id: 'u2', name: 'Ada', email: 'ada@example.com' }],
  organizations: [
    { id: 'kubwa', name: 'Kubwa', location: 'Abuja', owner_id: 'u1' },
    { id: 'wuse', name: 'Wuse', location: null, owner_id: 'u2' },
  ],
  org_invites: [
    { org_id: 'wuse', email: 'destiny@example.com', status: 'accepted', visible_pages: ['daily-sales'], organizations: { id: 'wuse', name: 'Wuse', location: null } },
    { org_id: 'kubwa', email: 'ada@example.com', status: 'pending', visible_pages: [], organizations: { id: 'kubwa', name: 'Kubwa' } },
  ],
})

console.log('Signing in')
const me = await accountFor(db, 'u1')
check('says who they are', me.user.id === 'u1' && me.user.name === 'Destiny' && me.user.email === 'destiny@example.com')
check('with the stations they own', me.stations.some((s) => s.id === 'kubwa' && s.role === 'owner'))
check('and those they were invited to, with their pages', me.stations.some((s) => s.id === 'wuse' && s.role === 'staff' && s.visiblePages?.[0] === 'daily-sales'))
const ada = await accountFor(db, 'u2')
check('a pending invite gives nothing', !ada.stations.some((s) => s.id === 'kubwa'))
check('no account for the sign-in is refused', (await accountFor(db, 'nobody')).error !== undefined)

console.log('\nCreating an account')
const calls = []
const anon = {
  auth: {
    async signUp(args) { calls.push(['signUp', args]); return { data: { user: { id: 'u9' } }, error: null } },
    async signInWithPassword(args) { calls.push(['signIn', args]); return { data: { user: { id: 'u9' } }, error: null } },
    async signOut() { calls.push(['signOut']) },
  },
}
const made = await signUpWith(anon, { name: ' New Person ', email: ' New@Example.com ', password: 'secret123' })
check('signs them up as the website does', calls[0]?.[0] === 'signUp' && calls[0][1].email === 'new@example.com' && calls[0][1].options.data.name === 'New Person')
check('and checks the password works', made.userId === 'u9' && calls.some(([c]) => c === 'signIn'))
check('a short password is refused before the web is asked', (await signUpWith(anon, { name: 'X', email: 'x@example.com', password: '123' })).error !== undefined)
check('a missing name is refused', (await signUpWith(anon, { name: ' ', email: 'x@example.com', password: 'secret123' })).error !== undefined)
const taken = await signUpWith({ auth: { async signUp() { return { error: { message: 'User already registered' } } } } }, { name: 'A', email: 'a@example.com', password: 'secret123' })
check('an email already registered says so', /already/i.test(taken.error || ''))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
