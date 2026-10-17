/**
 * Pins "Make the web match this computer" (lib/local/webSync.js replaceWeb): the station on the
 * computer is the source of truth when it corrects something. The web station's copy is cleared
 * (app/api/desktop/wipe) and every row of the station here is pushed; until that has finished a
 * pull does not bring the web's old rows back (the bug: they came back beside the corrected
 * ones, doubling a day). Runs the real webSync on fake-indexeddb with a stand-in web.
 *
 * Run: node tests/desktop-replace-web.test.mjs
 */
import 'fake-indexeddb/auto'
import { register } from 'node:module'
import { generateKeyPair, exportSPKI, SignJWT } from 'jose'

register('./helpers/app-loader.mjs', import.meta.url)

const memory = new Map()
const storage = () => ({ getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) })
globalThis.localStorage = storage()
globalThis.sessionStorage = storage()

const { privateKey, publicKey } = await generateKeyPair('ES256')
process.env.NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY = (await exportSPKI(publicKey)).replace(/\n/g, '\\n')
const soon = new Date(Date.now() + 10 * 864e5).toISOString()
const licence = await new SignJWT({ svc: { 'fuel-operations': soon } }).setProtectedHeader({ alg: 'ES256' }).setIssuer('stationmgr').setAudience('stationmgr-desktop').setSubject('kubwa').setIssuedAt().sign(privateKey)

// The web: what it was asked, and its old rows for a pull.
const asked = []
let pushedRows = []
globalThis.window = {
  dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
  stationmgr: {
    async request({ method, path, body }) {
      asked.push(path)
      if (path === '/api/desktop/wipe') return { ok: true, status: 200, body: { ok: true, licence } }
      if (path === '/api/desktop/push') {
        pushedRows.push(...body.changes)
        return { ok: true, status: 200, body: { results: body.changes.map((c) => ({ table: c.table, id: c.id, ok: true })), licence } }
      }
      if (path === '/api/desktop/pull') {
        return { ok: true, status: 200, body: { licence, station: { name: 'Kubwa' }, rows: { daily_sales_entries: [{ id: 'old-web-sale', org_id: 'kubwa', entry_date: '2026-10-05' }] } } }
      }
      if (path === '/api/desktop/licence') return { ok: true, status: 200, body: { licence } }
      return { ok: false, status: 404, body: {} }
    },
  },
}

const { store } = await import('../lib/local/store.js')
const { setLink, getLink, setCurrentStationId } = await import('../lib/local/link.js')
const { saveLicence, checkLicence } = await import('../lib/local/licence.js')
const sync = await import('../lib/local/webSync.js')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

setLink({ stationId: 'kubwa', stationName: 'Kubwa' })
setCurrentStationId('kubwa')
await saveLicence(licence, 'kubwa')
await checkLicence(Date.now(), 'kubwa')
await store.organizations.put({ id: 'kubwa', name: 'Kubwa', owner_id: 'me' })
await store.station_pumps.put({ id: 'p1', org_id: 'kubwa', fuel_type: 'PMS', pump_number: 1 })
await store.daily_sales_entries.put({ id: 'fixed-sale', org_id: 'kubwa', entry_date: '2026-10-05' })

console.log('A correction waiting to replace the web copy')
sync.markReplaceWeb('kubwa')
check('is noted on the station', getLink('kubwa').replacePending === true)
asked.length = 0
const pulled = await sync.pull({ stationId: 'kubwa' })
check('a pull replaces the web copy instead of taking its rows', asked[0] === '/api/desktop/wipe' && !asked.includes('/api/desktop/pull'))
check('so the web’s old row does not come back', !(await store.daily_sales_entries.get('old-web-sale')))
check('every row here went up', pushedRows.some((c) => c.id === 'fixed-sale') && pushedRows.some((c) => c.id === 'p1') && pushedRows.some((c) => c.id === 'kubwa'))
check('and the note is cleared', pulled.ok && !getLink('kubwa').replacePending)

console.log('\nAfterwards')
asked.length = 0
await sync.pull({ stationId: 'kubwa' })
check('pulls as usual again (staff entries from the web come down)', asked.includes('/api/desktop/pull') && Boolean(await store.daily_sales_entries.get('old-web-sale')))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
