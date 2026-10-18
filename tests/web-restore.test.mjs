/**
 * Pins Restore from backup on the web (lib/webRestore.js, app/api/stations/[stationId]/restore):
 * a StationMGR Desktop backup file restored into a web station from its Settings, by overwrite
 * or pad (lib/restoreInto.js decides what; tests/web-restore-plan.test.mjs pins that).
 *
 * Runs against an in-memory stand-in for Supabase, and reads the route's source for who may.
 *
 * Run: node tests/web-restore.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { restoreIntoStation } = await import(pathToFileURL(resolve(root, 'lib', 'webRestore.js')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

/**
 * Enough of the Supabase client for a restore: select with eq and range (pages of `pageSize`, as
 * PostgREST caps a read), delete and update with eq, insert. A column in `unknown` is refused as
 * PostgREST refuses one the table does not have.
 */
function fakeSupabase(tables, { unknown = {}, pageSize = 1000 } = {}) {
  const calls = []
  const from = (table) => {
    const q = { op: 'select', filters: [] }
    const rows = () => (tables[table] ||= [])
    const match = (r) => q.filters.every(([c, v]) => r[c] === v)
    const run = () => {
      calls.push({ table, op: q.op })
      if (q.op === 'select') {
        const all = rows().filter(match)
        const [a, b] = q.range || [0, all.length - 1]
        return { data: all.slice(a, Math.min(b, a + pageSize - 1) + 1), error: null }
      }
      if (q.op === 'delete') { tables[table] = rows().filter((r) => !match(r)); return { error: null } }
      if (q.op === 'update') { for (const r of rows().filter(match)) Object.assign(r, q.values); return { error: null } }
      if (q.op === 'insert') {
        for (const r of q.rows) {
          const bad = Object.keys(r).find((c) => (unknown[table] || []).includes(c))
          if (bad) return { error: { code: 'PGRST204', message: `Could not find the '${bad}' column of '${table}' in the schema cache` } }
        }
        rows().push(...q.rows.map((r) => ({ ...r })))
        return { error: null }
      }
    }
    const api = {
      select() { q.op = 'select'; return api },
      delete() { q.op = 'delete'; return api },
      update(values) { q.op = 'update'; q.values = values; return api },
      insert(r) { q.op = 'insert'; q.rows = r; return api },
      eq(c, v) { q.filters.push([c, v]); return api },
      range(a, b) { q.range = [a, b]; return api },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    return api
  }
  return { from, calls }
}

const S = 'web-station'
const OTHER = 'other-station'
const OWNER = 'owner-1'
let n = 0
const newId = () => `new-${++n}`

const backup = {
  format: 'stationmgr-backup',
  tables: {
    organizations: [{ id: 'desk-org', name: 'Lucky Way', onboarding_complete: true }],
    station_tanks: [{ id: 'bt1', org_id: 'desk-org', fuel_type: 'PMS', tank_number: 1 }],
    station_pumps: [{ id: 'bp1', org_id: 'desk-org', fuel_type: 'PMS', pump_number: 1, tank_id: 'bt1', balance: 3 }],
    station_banks: [{ id: 'bb1', org_id: 'desk-org', bank_name: 'GTB', lodgement_type: 'pos' }],
    daily_sales_entries: [
      { id: 'bd1', org_id: 'desk-org', entry_date: '2026-10-01', created_by: 'staff-on-computer', nozzle_readings: [{ pump_id: 'bp1' }], tank_readings: [{ tank_id: 'bt1' }] },
      { id: 'bd2', org_id: 'desk-org', entry_date: '2026-10-02', created_by: 'staff-on-computer', nozzle_readings: [{ pump_id: 'bp1' }] },
    ],
    lodgement_entries: [{ id: 'bl1', org_id: 'desk-org', entry_date: '2026-10-01', bank_id: 'bb1' }],
    imprest_entries: [{ id: 'bi1', org_id: 'desk-org', entry_date: '2026-10-01', receipt_image_url: 'data:image/png;base64,AAAA' }],
    station_messages: [{ id: 'm1', org_id: 'desk-org' }],
  },
}

const station = () => ({
  organizations: [{ id: S, name: 'Web copy', owner_id: OWNER, onboarding_complete: false }, { id: OTHER, name: 'Other' }],
  station_tanks: [{ id: 'wt1', org_id: S, fuel_type: 'PMS', tank_number: 1 }, { id: 'ot1', org_id: OTHER, fuel_type: 'PMS', tank_number: 1 }],
  station_pumps: [{ id: 'wp9', org_id: S, fuel_type: 'PMS', pump_number: 9, tank_id: 'wt1' }],
  daily_sales_entries: [{ id: 'wd1', org_id: S, entry_date: '2026-10-01', nozzle_readings: [] }, { id: 'od1', org_id: OTHER, entry_date: '2026-10-01' }],
})
const of = (db, table, org = S) => (db[table] || []).filter((r) => r.org_id === org)

console.log('Not a backup')
{
  const db = station()
  const out = await restoreIntoStation(fakeSupabase(db), { backup: { tables: {} }, stationId: S, ownerId: OWNER, mode: 'pad', newId })
  check('is refused, and nothing changes', !out.ok && /not a StationMGR backup/.test(out.error) && of(db, 'daily_sales_entries').length === 1)
}

console.log('\nThe warning')
{
  const db = station()
  const out = await restoreIntoStation(fakeSupabase(db), { backup, stationId: S, ownerId: OWNER, preview: true, newId })
  check('says what the backup would create and what only the station has', out.summary.missing.station_banks.length === 1 && out.summary.extra.station_pumps.includes('PMS 9'))
  check('and changes nothing', of(db, 'station_pumps').length === 1)
}

console.log('\nOverwrite everything')
{
  const db = station()
  const fake = fakeSupabase(db, { unknown: { station_pumps: ['balance'] } })
  n = 0
  const out = await restoreIntoStation(fake, { backup, stationId: S, ownerId: OWNER, mode: 'overwrite', newId })
  check('succeeds', out.ok === true)
  check('the station becomes exactly the backup', of(db, 'station_pumps').length === 1 && of(db, 'daily_sales_entries').length === 2 && !of(db, 'station_pumps').some((p) => p.id === 'wp9'))
  check('another station is untouched', of(db, 'station_tanks', OTHER).length === 1 && of(db, 'daily_sales_entries', OTHER).length === 1)
  const tank = of(db, 'station_tanks')[0]
  check('pumps and readings point at the station’s new tank and pump', of(db, 'station_pumps')[0].tank_id === tank.id && of(db, 'daily_sales_entries').every((e) => e.nozzle_readings[0].pump_id === of(db, 'station_pumps')[0].id))
  check('a column the web does not have is left out, the row still comes in', of(db, 'station_pumps')[0].balance === undefined)
  check('entries are the owner’s (the computer’s staff are not web accounts)', of(db, 'daily_sales_entries').every((e) => e.created_by === OWNER))
  check('a receipt image held in the file does not come in', of(db, 'imprest_entries')[0].receipt_image_url === null)
  check('messages and other tables are not restored', !(db.station_messages || []).length)
  check('the station’s setup is done when the backup’s was', db.organizations[0].onboarding_complete === true)
  const order = fake.calls.filter((c) => c.op === 'delete').map((c) => c.table)
  check('entries are cleared before the setup they point at, pumps before tanks', order.indexOf('daily_sales_entries') < order.indexOf('station_pumps') && order.indexOf('station_pumps') < order.indexOf('station_tanks'))
  check('counts what came in', out.counts.daily_sales_entries.added === 2)
}

console.log('\nPad with new values')
{
  const db = station()
  n = 0
  const out = await restoreIntoStation(fakeSupabase(db), { backup, stationId: S, ownerId: OWNER, mode: 'pad', newId })
  check('succeeds', out.ok === true)
  check('keeps the station’s own tank and pump, adding none twice', of(db, 'station_tanks').length === 1 && of(db, 'station_tanks')[0].id === 'wt1' && of(db, 'station_pumps').length === 2)
  check('the backup’s sale comes in only for a day the station has none', of(db, 'daily_sales_entries').length === 2 && of(db, 'daily_sales_entries').some((e) => e.entry_date === '2026-10-02'))
  check('its readings point at the station’s own tank', of(db, 'station_pumps').find((p) => p.pump_number === 1).tank_id === 'wt1')
}

console.log('\nA station with more rows than one read returns')
{
  const db = station()
  db.daily_sales_entries.push(...Array.from({ length: 2500 }, (_, i) => ({ id: `many-${i}`, org_id: S, entry_date: `2020-01-${i}` })))
  n = 0
  const out = await restoreIntoStation(fakeSupabase(db, { pageSize: 1000 }), { backup, stationId: S, ownerId: OWNER, preview: true, newId })
  check('is read in full', out.ok && out.here.daily_sales_entries === 2501)
}

console.log('\nWho may (app/api/stations/[stationId]/restore)')
{
  const src = readFileSync(resolve(root, 'app', 'api', 'stations', '[stationId]', 'restore', 'route.js'), 'utf8')
  check('only the station’s owner', src.includes('owner_id !== user.id'))
  check('only with a subscription running', src.includes('anyServiceRunning('))
  check('never while a computer is linked to it', src.includes("from('desktop_devices')") && src.includes(".is('revoked_at', null)") && src.includes('409'))
}

console.log('\nWhere it is')
{
  const settings = readFileSync(resolve(root, 'screens', 'dashboard', 'stations', '[stationId]', 'settings', 'page.js'), 'utf8')
  const sidebar = readFileSync(resolve(root, 'components', 'StationSidebar.js'), 'utf8')
  const restore = readFileSync(resolve(root, 'components', 'RestoreBackup.js'), 'utf8')
  check('not on the Settings page', !settings.includes('RestoreBackup'))
  check('the last row of the station switcher, for the owner', /action=\{isOwner \? \{ label: 'Restore from backup'/.test(sidebar) && sidebar.includes('<RestoreBackup'))
  check('its warning is put on the page, not inside the drawer that closes', restore.includes('createPortal(') && restore.includes('document.body'))
}

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
