/**
 * Restores a real backup through the in-app server's restore (lib/local/routes/local/backup),
 * on the real local store (fake-indexeddb): the Lucky Way backup, a station made offline, onto a
 * computer that already has a different station made offline under the same fixed local id.
 *
 * It must be added beside that station with its own 12 pumps and 3 tanks, not merged (which
 * doubled every pump in the entries), and restoring it again must replace that copy.
 *
 * Needs the backup file beside the project (../StationMGR_RAINOIL_LUCKY_WAY_*.json); skipped
 * without it.
 *
 * Run: node tests/desktop-restore-route.test.mjs
 */
import 'fake-indexeddb/auto'
import { register } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateKeyPair, exportSPKI, SignJWT } from 'jose'

register('./helpers/app-loader.mjs', import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))
const outside = resolve(__dirname, '..', '..')
const file = readdirSync(outside).find((f) => /^StationMGR_RAINOIL_LUCKY_WAY_.*\.json$/.test(f))
if (!file) {
  console.log('Skipped: no Lucky Way backup beside the project')
  process.exit(0)
}
const backupText = readFileSync(resolve(outside, file), 'utf8')
const backup = JSON.parse(backupText)

const memory = new Map()
const storage = () => ({ getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) })
globalThis.localStorage = storage()
globalThis.sessionStorage = storage()
globalThis.window = { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} }

// Restoring needs a subscription on a station here: a linked one with a licence.
const { privateKey, publicKey } = await generateKeyPair('ES256')
process.env.NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY = (await exportSPKI(publicKey)).replace(/\n/g, '\\n')

const { store } = await import('../lib/local/store.js')
const { setLink } = await import('../lib/local/link.js')
const { saveLicence } = await import('../lib/local/licence.js')
const { setSessionUserId } = await import('../lib/local/session.js')
const { LOCAL_STATION_ID } = await import('../lib/local/constants.js')
const { POST } = await import('../lib/local/routes/local/backup/route.js')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

// This computer: Destiny's web account, a paid linked station, and another station made offline.
await store.users.put({ id: 'me', email: 'destiny@example.com', name: 'Destiny', web_account: true })
await store.organizations.bulkPut([
  { id: LOCAL_STATION_ID, name: 'Other offline station', owner_id: 'me', onboarding_complete: true },
  { id: 'paid-station', name: 'Paid', owner_id: 'me', onboarding_complete: true },
])
await store.station_pumps.bulkPut([{ id: 'x1', org_id: LOCAL_STATION_ID, fuel_type: 'PMS', pump_number: 1 }, { id: 'x2', org_id: LOCAL_STATION_ID, fuel_type: 'AGO', pump_number: 1 }])
setLink({ stationId: 'paid-station', stationName: 'Paid' })
const soon = new Date(Date.now() + 10 * 864e5).toISOString()
await saveLicence(await new SignJWT({ svc: { 'fuel-operations': soon } }).setProtectedHeader({ alg: 'ES256' }).setIssuer('stationmgr').setAudience('stationmgr-desktop').setSubject('paid-station').setIssuedAt().sign(privateKey))
setSessionUserId('me')

const restore = () => POST(new Request('http://app/api/local/backup', { method: 'POST', body: backupText }))
const pumpsOf = async (id) => store.station_pumps.where('org_id').equals(id).count()
const tanksOf = async (id) => store.station_tanks.where('org_id').equals(id).count()

console.log('Restoring Lucky Way beside another station made offline')
let res = await restore()
let body = await res.json()
check('restores', res.ok)
const id = body.station?.id
check('as a station of its own', id && id !== LOCAL_STATION_ID && (await store.organizations.count()) === 3)
check(`with its own ${backup.tables.station_pumps.length} pumps and ${backup.tables.station_tanks.length} tanks`, (await pumpsOf(id)) === backup.tables.station_pumps.length && (await tanksOf(id)) === backup.tables.station_tanks.length)
check('the other station keeps only its own 2 pumps', (await pumpsOf(LOCAL_STATION_ID)) === 2)
check('its daily sales all come in', (await store.daily_sales_entries.where('org_id').equals(id).count()) === backup.tables.daily_sales_entries.length)
check('and the person restoring owns it here', (await store.organizations.get(id)).owner_id === 'me')

console.log('\nRestoring the same backup again')
res = await restore()
body = await res.json()
check('replaces that copy', res.ok && body.station?.id === id && (await store.organizations.count()) === 3)
check('with no pump doubled', (await pumpsOf(id)) === backup.tables.station_pumps.length)

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
