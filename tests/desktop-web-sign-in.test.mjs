/**
 * Pins how StationMGR Desktop signs people in with their web account (lib/local/accounts.js):
 * online the web checks the email and password; the computer keeps its own check of the
 * password so the next sign-in works offline; a wrong password on the web is wrong here too;
 * and the stations the web says they own or were invited to open for them here.
 *
 * Runs the real local store on fake-indexeddb, with a stand-in for the Electron bridge.
 *
 * Run: node tests/desktop-web-sign-in.test.mjs
 */
import 'fake-indexeddb/auto'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const tmp = resolve(root, 'node_modules', '.cache', 'desktop-web-sign-in-test')
mkdirSync(tmp, { recursive: true })
copyFileSync(resolve(root, 'lib', 'local', 'schema.json'), resolve(tmp, 'schema.json'))
for (const name of ['store', 'accounts', 'web', 'pin', 'session', 'link', 'constants']) {
  let src = readFileSync(resolve(root, 'lib', 'local', `${name}.js`), 'utf8')
    .replace("import schema from './schema.json'", "import schema from './schema.json' with { type: 'json' }")
    .replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
  writeFileSync(resolve(tmp, `${name}.mjs`), src)
}

// localStorage and sessionStorage are kept apart, as in a browser.
const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
globalThis.localStorage = storage()
globalThis.sessionStorage = storage()

// The web, through the Electron bridge: one account, Destiny, who owns Kubwa and was invited to Wuse.
let online = true
const asked = []
globalThis.window = {
  dispatchEvent() {},
  stationmgr: {
    async account({ path, body }) {
      asked.push(path)
      if (!online) return { ok: false, status: 0, body: { error: 'The web cannot be reached' } }
      if (path === '/api/desktop/sign-in') {
        if (body.email !== 'destiny@example.com' || body.password !== (globalThis.webPassword || 'right-one')) return { ok: false, status: 401, body: { error: 'Wrong email or password' } }
        return { ok: true, status: 200, body: { user: { id: 'u1', name: 'Destiny', email: 'destiny@example.com' }, stations: [
          { id: 'kubwa', name: 'Kubwa', role: 'owner' },
          { id: 'wuse', name: 'Wuse', role: 'staff', visiblePages: ['daily-sales'] },
        ], ...(globalThis.webInvites !== undefined ? { invites: globalThis.webInvites } : {}) } }
      }
      return { ok: false, status: 404, body: {} }
    },
  },
}

const { store } = await import(pathToFileURL(resolve(tmp, 'store.mjs')).href)
const accounts = await import(pathToFileURL(resolve(tmp, 'accounts.mjs')).href)
const session = await import(pathToFileURL(resolve(tmp, 'session.mjs')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

// Kubwa is linked here and was owned by an old PIN account; Wuse is here too.
await store.users.put({ id: 'old-pin', email: 'manager', name: 'Old manager', pin_hash: 'x' })
await store.organizations.bulkPut([{ id: 'kubwa', name: 'Kubwa', owner_id: 'old-pin' }, { id: 'wuse', name: 'Wuse', owner_id: 'someone' }])

console.log('Online, with the web account')
let r = await accounts.signIn({ email: ' Destiny@Example.com ', password: 'right-one' })
check('signs in', r.ok && session.getSessionUserId() === 'u1')
check('keeps the person here, marked a web account', (await store.users.get('u1'))?.web_account === true)
check('without keeping the password itself', (await store.users.get('u1'))?.pin_hash !== 'right-one')
check('a station they own here becomes theirs here', (await store.organizations.get('kubwa')).owner_id === 'u1')
const invite = (await store.org_invites.toArray()).find((i) => i.org_id === 'wuse')
check('a station they were invited to opens for them, with their pages', invite?.email === 'destiny@example.com' && invite.status === 'accepted' && invite.visible_pages?.[0] === 'daily-sales')

console.log('\nOffline')
session.clearSession()
online = false
r = await accounts.signIn({ email: 'destiny@example.com', password: 'right-one' })
check('signs in with the password checked here', r.ok && session.getSessionUserId() === 'u1')
session.clearSession()
r = await accounts.signIn({ email: 'destiny@example.com', password: 'wrong' })
check('a wrong password is refused', !r.ok && !session.getSessionUserId())
r = await accounts.signIn({ email: 'new@example.com', password: 'anything' })
check('someone never signed in here needs the internet', !r.ok && /internet/i.test(r.error))

console.log('\nOnline again, after the password changed on the web')
online = true
globalThis.webPassword = 'new-one'
r = await accounts.signIn({ email: 'destiny@example.com', password: 'right-one' })
check('the old password is refused, though it was right here', !r.ok && /wrong/i.test(r.error))
r = await accounts.signIn({ email: 'destiny@example.com', password: 'new-one' })
check('the new one signs in', r.ok)
session.clearSession()
online = false
check('and is the one checked offline after that', (await accounts.signIn({ email: 'destiny@example.com', password: 'new-one' })).ok)

console.log('\nWho may do what')
await store.users.put({ id: 'staff1', email: 'cashier@example.com', name: 'Cashier', web_account: true })
await store.org_invites.put({ id: 'i9', org_id: 'kubwa', email: 'cashier@example.com', status: 'accepted' })
await store.users.put({ id: 'fresh', email: 'new@example.com', name: 'New', web_account: true })
check('an owner may add stations', await accounts.canAddStations('u1'))
check('a new account with no stations may too', await accounts.canAddStations('fresh'))
check('staff may too, as on the web', await accounts.canAddStations('staff1'))
check('someone not signed in here may not', !(await accounts.canAddStations('nobody')))
await store.organizations.put({ id: 'old', name: 'Old place', owner_id: 'old-pin' })
const unowned = (await accounts.stationsWithNoOwnerHere()).map((s) => s.id)
check('a station owned by an old PIN account has no owner here', unowned.includes('old'))
check('one owned by a web account here has', !unowned.includes('kubwa'))

console.log('\nInvites waiting on the web')
online = true
globalThis.webInvites = [{ id: 'inv1', stationId: 'garki', stationName: 'Garki', location: 'Abuja' }]
await accounts.signIn({ email: 'destiny@example.com', password: 'new-one' })
let destiny = await store.users.get('u1')
check('a pending invite is kept with the person', destiny.pending_invites?.length === 1 && destiny.pending_invites[0].stationName === 'Garki')
check('and opens no station here', !(await store.org_invites.filter((i) => i.org_id === 'garki').count()))
delete globalThis.webInvites
await accounts.signIn({ email: 'destiny@example.com', password: 'new-one' })
destiny = await store.users.get('u1')
check('a web that does not send invites yet leaves the list as it was', destiny.pending_invites?.length === 1)
globalThis.webInvites = []
await accounts.signIn({ email: 'destiny@example.com', password: 'new-one' })
destiny = await store.users.get('u1')
check('once accepted on the web, it is gone at the next sign-in', destiny.pending_invites?.length === 0)

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
