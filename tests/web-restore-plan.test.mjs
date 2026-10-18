/**
 * Pins restoring a backup into a station, whichever station it came from
 * (lib/restoreInto.js; on the web, Restore from backup: app/api/stations/[stationId]/restore).
 * Two ways, chosen after a warning that says what differs:
 *
 *   overwrite  the station becomes exactly the backup: setup, opening balances, entries
 *   pad        the station keeps what it has and gains only what is missing: setup it lacks
 *              (matched by fuel and number, bank name and type, customer or product name), and
 *              entries for days it has none of that kind
 *
 * Either way the backup's entries point at the station's own pumps, tanks, banks, customers and
 * products, created rows get new ids, and nothing is doubled. Uses the Lucky Way backup beside
 * the project (skipped without it).
 *
 * Run: node tests/web-restore-plan.test.mjs
 */
import { readdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outside = resolve(__dirname, '..', '..')
const file = readdirSync(outside).find((f) => /^StationMGR_RAINOIL_LUCKY_WAY_.*\.json$/.test(f))
if (!file) { console.log('Skipped: no Lucky Way backup beside the project'); process.exit(0) }
const backup = JSON.parse(readFileSync(resolve(outside, file), 'utf8'))
const { restoreIntoPlan, summarize } = await import(pathToFileURL(resolve(__dirname, '..', 'lib', 'restoreInto.js')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
let n = 0
const newId = () => `new-${++n}`
const S = 'station-here'

// The station open now: PMS pump 1 and AGO pump 1 (its own ids), one PMS tank 2, one of its own
// sales on 1 October, and a pump the backup does not have.
const here = {
  station_tanks: [{ id: 't-own', org_id: S, fuel_type: 'PMS', tank_number: 2, opening_stock: 5000 }],
  station_pumps: [
    { id: 'p-own-1', org_id: S, fuel_type: 'PMS', pump_number: 1, tank_id: 't-own', initial_reading: 1 },
    { id: 'p-own-2', org_id: S, fuel_type: 'AGO', pump_number: 1, initial_reading: 2 },
    { id: 'p-extra', org_id: S, fuel_type: 'PMS', pump_number: 9 },
  ],
  station_banks: [], station_customers: [], station_lube_products: [],
  daily_sales_entries: [{ id: 'own-sale', org_id: S, entry_date: '2026-10-01', nozzle_readings: [] }],
  lodgement_entries: [], product_receipt_entries: [], lube_sales_entries: [], lube_stock_entries: [],
  customer_payment_entries: [], imprest_periods: [], imprest_entries: [],
}
const b = backup.tables
const ids = (rows) => new Set((rows || []).map((r) => r.id))

console.log('The warning')
const sum = summarize(backup, here)
check('names what the backup would create', sum.missing.station_pumps.includes('PMS 2') && !sum.missing.station_pumps.includes('PMS 1'))
check('and what the station has that the backup does not', sum.extra.station_pumps.includes('PMS 9'))
check('with the backup’s size', sum.backup.station_pumps === b.station_pumps.length && sum.backup.daily_sales_entries === b.daily_sales_entries.length)

console.log('\nOverwrite everything')
n = 0
let plan = restoreIntoPlan({ backup, here, mode: 'overwrite', stationId: S, newId })
check('removes all the station’s own setup and entries', plan.deletes.station_pumps.length === 3 && plan.deletes.daily_sales_entries.includes('own-sale'))
check(`puts exactly the backup’s ${b.station_pumps.length} pumps and ${b.station_tanks.length} tanks`, plan.puts.station_pumps.length === b.station_pumps.length && plan.puts.station_tanks.length === b.station_tanks.length)
check('under the station, with new ids', plan.puts.station_pumps.every((p) => p.org_id === S && p.id.startsWith('new-')))
const tankIds = ids(plan.puts.station_tanks)
check('pumps point at the new tanks', plan.puts.station_pumps.filter((p) => p.tank_id).every((p) => tankIds.has(p.tank_id)))
const pumpIds = ids(plan.puts.station_pumps)
check('every sale’s meter reading points at a new pump', plan.puts.daily_sales_entries.every((e) => (e.nozzle_readings || []).every((r) => pumpIds.has(r.pump_id))))
check('every tank reading at a new tank', plan.puts.daily_sales_entries.every((e) => (e.tank_readings || []).every((r) => tankIds.has(r.tank_id))))
const bankIds = ids(plan.puts.station_banks)
check('every lodgement at a new bank', plan.puts.lodgement_entries.every((l) => !l.bank_id || bankIds.has(l.bank_id)))
check('every receipt at a new tank', plan.puts.product_receipt_entries.every((r) => !r.tank_id || tankIds.has(r.tank_id)))
check('all its sales and lodgements come in', plan.puts.daily_sales_entries.length === b.daily_sales_entries.length && plan.puts.lodgement_entries.length === b.lodgement_entries.length)

console.log('\nPad with new values')
n = 0
plan = restoreIntoPlan({ backup, here, mode: 'pad', stationId: S, newId })
check('removes nothing', Object.values(plan.deletes).every((d) => d.length === 0))
check(`creates only the missing pumps (${b.station_pumps.length - 2})`, plan.puts.station_pumps.length === b.station_pumps.length - 2)
check('keeps the station’s own PMS tank 2, creating the other two', plan.puts.station_tanks.length === b.station_tanks.length - 1)
const padPumps = new Set([...ids(plan.puts.station_pumps), 'p-own-1', 'p-own-2', 'p-extra'])
check('the backup’s sales point at the station’s own PMS 1 and AGO 1', plan.puts.daily_sales_entries.some((e) => e.nozzle_readings.some((r) => r.pump_id === 'p-own-1')) && plan.puts.daily_sales_entries.every((e) => e.nozzle_readings.every((r) => padPumps.has(r.pump_id))))
check('a day the station has a sale of its own keeps it', !plan.puts.daily_sales_entries.some((e) => e.entry_date === '2026-10-01'))
check('the other days come in', plan.puts.daily_sales_entries.length === b.daily_sales_entries.filter((e) => e.entry_date !== '2026-10-01').length)
check('created rows have new ids, so no other station is touched', [...plan.puts.station_pumps, ...plan.puts.daily_sales_entries].every((r) => r.id.startsWith('new-')))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
