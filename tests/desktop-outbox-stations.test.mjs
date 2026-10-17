/**
 * Pins that what waits to be pushed is kept per station (lib/local/outbox.js): with several
 * stations on one computer, a push of one sends only that station's changes, and marking one
 * station's records for a first push leaves the others alone. Changes from a computer from
 * before, made when it held one station, still go up with that station.
 *
 * Runs the real local store (lib/local/store.js) on fake-indexeddb.
 *
 * Run: node tests/desktop-outbox-stations.test.mjs
 */
import 'fake-indexeddb/auto'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const tmp = resolve(root, 'node_modules', '.cache', 'desktop-outbox-test')
mkdirSync(tmp, { recursive: true })
copyFileSync(resolve(root, 'lib', 'local', 'schema.json'), resolve(tmp, 'schema.json'))
writeFileSync(resolve(tmp, 'store.mjs'), readFileSync(resolve(root, 'lib', 'local', 'store.js'), 'utf8')
  .replace("import schema from './schema.json'", "import schema from './schema.json' with { type: 'json' }"))
writeFileSync(resolve(tmp, 'desktopTables.mjs'), readFileSync(resolve(root, 'lib', 'desktopTables.js'), 'utf8'))
writeFileSync(resolve(tmp, 'outbox.mjs'), readFileSync(resolve(root, 'lib', 'local', 'outbox.js'), 'utf8')
  .replace("from './store'", "from './store.mjs'")
  .replace("from '@/lib/desktopTables'", "from './desktopTables.mjs'"))

const { store } = await import(pathToFileURL(resolve(tmp, 'store.mjs')).href)
const outbox = await import(pathToFileURL(resolve(tmp, 'outbox.mjs')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const keys = (list) => list.map((c) => c.key).sort().join(' ')

console.log('Changes on two stations')
const kubwaSale = { id: 's1', org_id: 'kubwa' }
const wuseSale = { id: 's2', org_id: 'wuse' }
await store.daily_sales_entries.bulkPut([kubwaSale, wuseSale])
await outbox.recordChanges('daily_sales_entries', [kubwaSale], 'upsert')
await outbox.recordChanges('daily_sales_entries', [wuseSale], 'upsert')
await outbox.recordChanges('organizations', [{ id: 'wuse', name: 'Wuse' }], 'upsert')
check('a push of one sends only its own', keys(await outbox.pendingChanges('kubwa')) === 'daily_sales_entries:s1')
check('and the other’s wait for it', keys(await outbox.pendingChanges('wuse')) === 'daily_sales_entries:s2 organizations:wuse')
check('each counts its own', (await outbox.pendingCount('wuse')) === 2)
await outbox.recordChanges('daily_sales_entries', [kubwaSale], 'delete')
check('a deleted row still goes with its station', keys(await outbox.pendingChanges('kubwa')) === 'daily_sales_entries:s1')

console.log('\nMarking one station for a first push')
await store.outbox.clear()
await store.station_pumps.bulkPut([{ id: 'p1', org_id: 'kubwa' }, { id: 'p2', org_id: 'wuse' }])
await store.organizations.bulkPut([{ id: 'kubwa' }, { id: 'wuse' }])
await outbox.markEverythingChanged('wuse')
check('marks only that station’s rows', keys(await outbox.pendingChanges()) === 'daily_sales_entries:s2 organizations:wuse station_pumps:p2')

console.log('\nA change from a computer from before (no station noted)')
await store.outbox.clear()
await store.outbox.put({ key: 'daily_sales_entries:s1', table: 'daily_sales_entries', id: 's1', op: 'upsert', at: 1 })
await store.outbox.put({ key: 'daily_sales_entries:gone', table: 'daily_sales_entries', id: 'gone', op: 'delete', at: 2 })
check('goes with the station its row is in', keys(await outbox.pendingChanges('kubwa', { legacyStationId: 'kubwa' })).includes('daily_sales_entries:s1'))
check('and a deleted one with the station it was linked to', keys(await outbox.pendingChanges('kubwa', { legacyStationId: 'kubwa' })).includes('daily_sales_entries:gone'))
check('not with another station', !keys(await outbox.pendingChanges('wuse', { legacyStationId: 'kubwa' })).includes('gone'))

console.log('\nDiscarding waiting changes')
await store.outbox.clear()
await store.daily_sales_entries.put({ id: 'd1', org_id: 'kubwa', entry_date: '2026-10-12' })
await store.lodgement_entries.put({ id: 'l1', org_id: 'kubwa', entry_date: '2026-10-13' })
await outbox.recordChanges('daily_sales_entries', [{ id: 'd1', org_id: 'kubwa' }], 'upsert')
await outbox.recordChanges('lodgement_entries', [{ id: 'l1', org_id: 'kubwa' }], 'upsert')
await outbox.recordChanges('lodgement_entries', [{ id: 'l2', org_id: 'kubwa' }], 'delete')
await outbox.recordChanges('daily_sales_entries', [wuseSale], 'upsert')
const listed = await outbox.describeChanges(await outbox.pendingChanges('kubwa'))
check('lists each change in words', listed.some((c) => c.label === 'Daily sales' && c.date === '2026-10-12') && listed.some((c) => c.label === 'Lodgement' && c.date === '2026-10-13'))
check('says when one is a delete', listed.some((c) => c.key === 'lodgement_entries:l2' && c.deleted))
await outbox.discardChanges(['daily_sales_entries:d1', 'lodgement_entries:l2'])
check('drops the ones picked', keys(await outbox.pendingChanges('kubwa')) === 'lodgement_entries:l1')
check('and leaves another station’s alone', keys(await outbox.pendingChanges('wuse')) === 'daily_sales_entries:s2')

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
