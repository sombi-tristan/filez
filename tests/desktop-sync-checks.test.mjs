/**
 * Pins the checks that keep a station's setup single on this computer and on the web
 * (lib/local/setupKeys.js, lib/local/webSync.js): the web allows one pump per fuel and number,
 * one tank per fuel and number, and the screens one bank per name and type, one customer and one
 * lube product per name.
 *
 * The bug: the computer held every pump twice (a restore gave new ids, a pull brought the old
 * ones back); replacing the web copy then cleared the web and pushed both, the second of each was
 * refused, and the web's sales pointed at pumps it never got.
 *
 *   - replacing the web copy refuses, before clearing anything, while the station has doubles,
 *     and names them
 *   - a pull never adds a second pump or tank beside one waiting to go up
 *   - a row the web refuses after the web copy was replaced waits as an ordinary change: once
 *     it is discarded it stays gone, and the next pull does not clear the web again (it did, and
 *     marked every row to push again, so "234 changes to push" came back after each clear)
 *
 * Runs the real webSync on fake-indexeddb with a stand-in web.
 *
 * Run: node tests/desktop-sync-checks.test.mjs
 */
import 'fake-indexeddb/auto'
import { register } from 'node:module'
import { generateKeyPair, exportSPKI, SignJWT } from 'jose'

register('./helpers/app-loader.mjs', import.meta.url)

// localStorage and sessionStorage are kept apart, as in a browser.
const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
globalThis.localStorage = storage()
globalThis.sessionStorage = storage()

const { privateKey, publicKey } = await generateKeyPair('ES256')
process.env.NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY = (await exportSPKI(publicKey)).replace(/\n/g, '\\n')
const soon = new Date(Date.now() + 10 * 864e5).toISOString()
const licence = await new SignJWT({ svc: { 'fuel-operations': soon } }).setProtectedHeader({ alg: 'ES256' }).setIssuer('stationmgr').setAudience('stationmgr-desktop').setSubject('kubwa').setIssuedAt().sign(privateKey)

const asked = []
let webRows = {}
const refuseIds = new Set()
globalThis.window = {
  dispatchEvent() {}, addEventListener() {}, removeEventListener() {},
  stationmgr: {
    async request({ path, body }) {
      asked.push(path)
      if (path === '/api/desktop/wipe') return { ok: true, status: 200, body: { ok: true, licence } }
      if (path === '/api/desktop/push') return { ok: true, status: 200, body: { results: body.changes.map((c) => (refuseIds.has(c.id) ? { table: c.table, id: c.id, ok: false, error: 'Pump PMS 9 is already on the web' } : { table: c.table, id: c.id, ok: true })), licence } }
      if (path === '/api/desktop/pull') return { ok: true, status: 200, body: { licence, station: { name: 'Kubwa', group: 'RAINOIL' }, rows: webRows } }
      if (path === '/api/desktop/licence') return { ok: true, status: 200, body: { licence } }
      return { ok: false, status: 404, body: {} }
    },
  },
}

const { findDoubles } = await import('../lib/local/setupKeys.js')
const { store } = await import('../lib/local/store.js')
const { setLink, setCurrentStationId, getLink } = await import('../lib/local/link.js')
const { saveLicence, checkLicence } = await import('../lib/local/licence.js')
const { recordChanges, pendingChanges, discardChanges } = await import('../lib/local/outbox.js')
const sync = await import('../lib/local/webSync.js')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Finding doubles')
const doubles = findDoubles({
  station_pumps: [{ id: 'a', fuel_type: 'PMS', pump_number: 2 }, { id: 'b', fuel_type: 'PMS', pump_number: '2' }, { id: 'c', fuel_type: 'AGO', pump_number: 2 }],
  station_tanks: [{ id: 't1', fuel_type: 'PMS', tank_number: 1 }],
  station_banks: [{ id: 'k1', bank_name: 'GTB 3 ', lodgement_type: 'pos' }, { id: 'k2', bank_name: 'gtb 3', lodgement_type: 'pos' }, { id: 'k3', bank_name: 'GTB 3', lodgement_type: 'transfer' }],
})
check('the same fuel and pump number twice', doubles.some((d) => d.table === 'station_pumps' && d.label === 'PMS 2' && d.count === 2))
check('a bank twice, whatever its spacing or capitals', doubles.some((d) => d.table === 'station_banks' && d.count === 2))
check('not different fuels or lodgement types', doubles.length === 2)

setLink({ stationId: 'kubwa', stationName: 'Kubwa' })
setCurrentStationId('kubwa')
await saveLicence(licence, 'kubwa')
await checkLicence(Date.now(), 'kubwa')
await store.organizations.put({ id: 'kubwa', name: 'Kubwa', owner_id: 'me' })
await store.station_pumps.bulkPut([{ id: 'old', org_id: 'kubwa', fuel_type: 'PMS', pump_number: 2 }, { id: 'new', org_id: 'kubwa', fuel_type: 'PMS', pump_number: 2 }])

console.log('\nReplacing the web copy while the station has doubles')
asked.length = 0
const r = await sync.replaceWeb('kubwa')
check('refuses', r.ok === false)
check('and names them', /PMS 2/.test(r.error || ''))
check('without clearing the web', !asked.includes('/api/desktop/wipe'))

console.log('\nOnce the doubles are gone')
await store.station_pumps.delete('old')
asked.length = 0
check('it replaces the web copy', (await sync.replaceWeb('kubwa')).ok === true && asked[0] === '/api/desktop/wipe')

console.log('\nA pull beside a pump waiting to go up')
await store.station_pumps.put({ id: 'mine', org_id: 'kubwa', fuel_type: 'AGO', pump_number: 1 })
await recordChanges('station_pumps', [{ id: 'mine', org_id: 'kubwa' }], 'upsert')
webRows = { organizations: [{ id: 'kubwa', name: 'Kubwa' }], station_pumps: [
  { id: 'new', org_id: 'kubwa', fuel_type: 'PMS', pump_number: 2 },
  { id: 'theirs', org_id: 'kubwa', fuel_type: 'AGO', pump_number: 1 },
] }
await sync.pull({ stationId: 'kubwa' })
const ago = await store.station_pumps.filter((p) => p.fuel_type === 'AGO' && Number(p.pump_number) === 1).toArray()
check('does not add a second AGO 1', ago.length === 1 && ago[0].id === 'mine')

console.log('\nThe station’s group')
check('a pull keeps its name on the station, for the Rainoil workbooks', (await store.organizations.get('kubwa'))?.station_group === 'RAINOIL')

console.log('\nA row the web refuses after the web copy was replaced')
await store.station_pumps.put({ id: 'refused', org_id: 'kubwa', fuel_type: 'PMS', pump_number: 9 })
refuseIds.add('refused')
const replaced = await sync.replaceWeb('kubwa')
check('the replace reports it, with the reason', replaced.refused?.length === 1 && /PMS 9/.test(replaced.refused[0].error))
check('it waits to push, alone', (await pendingChanges('kubwa')).length === 1)
check('the web copy counts as replaced', !getLink('kubwa').replacePending)
await discardChanges((await pendingChanges('kubwa')).map((c) => c.key))
asked.length = 0
await sync.pull({ stationId: 'kubwa' })
check('after it is discarded, a pull does not clear the web again', !asked.includes('/api/desktop/wipe'))
check('nor mark every row to push again', (await pendingChanges('kubwa')).length === 0)

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
