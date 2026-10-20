/**
 * Pins the desktop's own consolidation for a station on this computer only
 * (lib/local/consolidate.js): the web's weekly job (consolidate_entries, migration 044) done
 * here, for one station. Entries before the cutoff (lib/consolidation.js) roll into the opening
 * balances, then go; so do entries deleted over a week ago. Other stations are not touched.
 *
 * Runs the real local store on fake-indexeddb.
 *
 * Run: node tests/desktop-consolidate.test.mjs
 */
import 'fake-indexeddb/auto'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const tmp = resolve(root, 'node_modules', '.cache', 'desktop-consolidate-test')
mkdirSync(tmp, { recursive: true })
copyFileSync(resolve(root, 'lib', 'local', 'schema.json'), resolve(tmp, 'schema.json'))
copyFileSync(resolve(root, 'lib', 'consolidation.js'), resolve(tmp, 'consolidation.mjs'))
for (const name of ['store', 'consolidate']) {
  const src = readFileSync(resolve(root, 'lib', 'local', `${name}.js`), 'utf8')
    .replace("import schema from './schema.json'", "import schema from './schema.json' with { type: 'json' }")
    .replace("from '@/lib/consolidation'", "from './consolidation.mjs'")
    .replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
  writeFileSync(resolve(tmp, `${name}.mjs`), src)
}
const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
globalThis.localStorage = storage()

const { store } = await import(pathToFileURL(resolve(tmp, 'store.mjs')).href)
const { consolidateStation, consolidateIfDue } = await import(pathToFileURL(resolve(tmp, 'consolidate.mjs')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

// Tuesday 20 Oct 2026: the last Sunday run's cutoff is 2026-07-20, new opening date 2026-07-21.
const now = new Date('2026-10-20T12:00:00Z')
const OLD = '2026-07-01'
const RECENT = '2026-08-01'
const daysAgo = (n) => new Date(now.getTime() - n * 86400000).toISOString()
const k = 'kubwa'

await store.station_banks.put({ id: 'b1', org_id: k, opening_balance: 1000 })
await store.lodgement_entries.bulkPut([
  { id: 'l-old', org_id: k, entry_date: OLD, amount: 200, bank_id: 'b1' },
  { id: 'l-old-deleted', org_id: k, entry_date: OLD, amount: 300, bank_id: 'b1', deleted_at: daysAgo(40) },
  { id: 'l-recent', org_id: k, entry_date: RECENT, amount: 50, bank_id: 'b1' },
  { id: 'l-deleted-long-ago', org_id: k, entry_date: RECENT, amount: 70, bank_id: 'b1', deleted_at: daysAgo(10) },
  { id: 'l-deleted-lately', org_id: k, entry_date: RECENT, amount: 80, bank_id: 'b1', deleted_at: daysAgo(2) },
])
await store.station_lube_products.put({ id: 'p1', org_id: k, opening_stock: 10 })
await store.lube_sales_entries.put({ id: 'ls-old', org_id: k, entry_date: OLD, product_id: 'p1', unit_received: 5, unit_sold: 2 })
await store.station_customers.put({ id: 'c1', org_id: k, opening_balance: 100 })
await store.customer_payment_entries.put({ id: 'cp-old', org_id: k, entry_date: OLD, customer_id: 'c1', sales_amount: 500, amount_paid: 300 })
await store.station_tanks.put({ id: 't1', org_id: k, opening_stock: 5000 })
await store.product_receipt_entries.put({ id: 'pr-old', org_id: k, entry_date: OLD, tank_id: 't1', actual_volume: 1000 })
await store.station_pumps.bulkPut([
  { id: 'u1', org_id: k, tank_id: 't1', initial_reading: 100 },
  { id: 'u2', org_id: k, tank_id: 't1', initial_reading: 50 },
])
await store.daily_sales_entries.bulkPut([
  { id: 'ds-old-1', org_id: k, entry_date: '2026-06-30', nozzle_readings: [{ pump_id: 'u1', closing_meter: 400, pour_back: 10 }, { pump_id: 'u2', closing_meter: null }] },
  { id: 'ds-old-2', org_id: k, entry_date: OLD, nozzle_readings: [{ pump_id: 'u1', closing_meter: 600, pour_back: 0 }] },
  { id: 'ds-recent', org_id: k, entry_date: RECENT, nozzle_readings: [{ pump_id: 'u1', closing_meter: 900 }] },
])
await store.lube_stock_entries.put({ id: 'lst-old', org_id: k, entry_date: OLD, product_id: 'p1', stock: 99 })
// Another station on the same computer, untouched.
await store.station_banks.put({ id: 'b9', org_id: 'wuse', opening_balance: 5 })
await store.lodgement_entries.put({ id: 'w-old', org_id: 'wuse', entry_date: OLD, amount: 1, bank_id: 'b9' })

const result = await consolidateStation(k, now)

console.log('Rolled into the opening balances')
const bank = await store.station_banks.get('b1')
check('a bank gains its old lodgements, not a deleted one', bank.opening_balance === 1200 && bank.opening_date === '2026-07-21')
const lube = await store.station_lube_products.get('p1')
check('a lube product gains received less sold', lube.opening_stock === 13 && lube.opening_date === '2026-07-21')
const customer = await store.station_customers.get('c1')
check('a customer gains sales less payments', customer.opening_balance === 300 && customer.opening_date === '2026-07-21')
const tank = await store.station_tanks.get('t1')
check('a tank gains its receipts and loses what its pumps sold, less pour back', tank.opening_stock === 5000 + 1000 - ((600 - 100) - 10) && tank.opening_date === '2026-07-21')
const u1 = await store.station_pumps.get('u1')
check('a pump starts from its highest old closing meter', u1.initial_reading === 600 && u1.opening_date === '2026-07-21')
const u2 = await store.station_pumps.get('u2')
check('a pump with no old meter keeps its own', u2.initial_reading === 50 && !u2.opening_date)

console.log('\nThen removed')
const ids = async (t) => (await store[t].toArray()).map((r) => r.id).sort()
check('old lodgements go, deleted or not', !(await ids('lodgement_entries')).some((id) => id.startsWith('l-old')))
check('recent ones stay', (await ids('lodgement_entries')).includes('l-recent'))
check('an entry deleted over a week ago goes', !(await ids('lodgement_entries')).includes('l-deleted-long-ago'))
check('one deleted lately stays', (await ids('lodgement_entries')).includes('l-deleted-lately'))
check('every table of the job is cleared of old entries', (await ids('daily_sales_entries')).join() === 'ds-recent' && !(await ids('lube_sales_entries')).length && !(await ids('lube_stock_entries')).length && !(await ids('customer_payment_entries')).length && !(await ids('product_receipt_entries')).length)
check('the result says what was done', result.cutoff === '2026-07-20' && result.removed === 9)

console.log('\nOnly this station')
check('another station keeps its entries and balances', (await store.station_banks.get('b9')).opening_balance === 5 && (await ids('lodgement_entries')).includes('w-old'))

console.log('\nOnce a week')
await store.lodgement_entries.put({ id: 'l-late', org_id: k, entry_date: OLD, amount: 1, bank_id: 'b1' })
const ran = await consolidateIfDue(k, now)
check('the first time it is due', ran?.cutoff === '2026-07-20')
const again = await consolidateIfDue(k, now)
check('not again for the same cutoff', again === null && (await ids('lodgement_entries')).includes('l-late') === false)
check('it remembers when', (await consolidateIfDue(k, new Date('2026-10-24T12:00:00Z'))) === null)

console.log('\nWhen it runs, and where it shows')
const auto = readFileSync(resolve(root, 'components', 'desktop', 'AutoSync.js'), 'utf8')
const wallet = readFileSync(resolve(root, 'components', 'StationWallet.js'), 'utf8')
check('on opening and on the timer, for the station open now when it is not linked', auto.includes("import { consolidateIfDue } from '@/lib/local/consolidate'") && /const tidy = async \(\) => \{[\s\S]*?if \(!getLink\(stationId\)\) await consolidateIfDue\(stationId\)/.test(auto) && auto.includes('setInterval(tidy, PULL_EVERY)'))
check('a failure stops nothing else', /try \{[\s\S]*?consolidateIfDue/.test(auto))
const consolidateSrc = readFileSync(resolve(root, 'lib', 'local', 'consolidate.js'), 'utf8')
check('a failure is kept, with its message, and tried again next round', /catch \(err\) \{\s*remember\(stationId, \{ \.\.\.lastConsolidated\(stationId\), error: err\.message, failedAt: now\.toISOString\(\) \}\)\s*throw err/.test(consolidateSrc))
check('and shows on the station card', wallet.includes('Consolidation failed: {consolidated.error}'))
check('the station card says when it was last done', wallet.includes('lastConsolidated(getCurrentStationId())') && wallet.includes('Old entries consolidated {when(consolidated.at)}'))
check('only for a station on this computer only', /!link && consolidated &&/.test(wallet))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
