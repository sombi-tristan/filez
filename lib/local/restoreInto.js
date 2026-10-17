/**
 * Desktop build: restoring a backup into the station open now, whichever station the backup
 * came from (lib/local/routes/local/backup). Pure, so tests/desktop-restore-into.test.mjs pins it.
 *
 *   overwrite  the station becomes exactly the backup: its setup, opening balances and entries;
 *              the station's own rows are removed
 *   pad        the station keeps everything it has and gains only what is missing: setup it does
 *              not have (matched by the keys below) and, for each kind of entry, the backup's
 *              entries on days the station has none of that kind
 *
 * Either way every row put gets a new id under the station, and the backup's entries are pointed
 * at the station's pumps, tanks, banks, customers and products (its own when matched, the new
 * ones otherwise), so no other station on the computer is touched and nothing is doubled.
 */

import { SETUP_KEYS } from './setupKeys.js'

// Setup, in the order rows are made (a pump points at a tank), with what makes two the same
// (lib/local/setupKeys.js, shared with the sync).
const SETUP = [
  ...['station_tanks', 'station_pumps', 'station_banks', 'station_customers', 'station_lube_products'].map((table) => ({ table, ...SETUP_KEYS[table] })),
  { table: 'imprest_periods', key: (r) => `${r.start_date}|${r.end_date}`, label: (r) => `Imprest ${r.start_date}` },
]

// Entries, and their day.
const ENTRIES = ['daily_sales_entries', 'product_receipt_entries', 'lodgement_entries', 'lube_sales_entries', 'lube_stock_entries', 'customer_payment_entries', 'imprest_entries']
const dayOf = (r) => r.entry_date || r.created_at?.slice(0, 10) || ''

export const RESTORE_TABLES = [...SETUP.map((s) => s.table), ...ENTRIES]

/** What the warning shows: the backup's size, its setup the station lacks, and the station's the backup lacks. */
export function summarize(backup, here) {
  const t = backup?.tables || {}
  const out = { name: t.organizations?.[0]?.name || '', backup: {}, missing: {}, extra: {} }
  for (const table of RESTORE_TABLES) out.backup[table] = (t[table] || []).length
  for (const { table, key, label } of SETUP) {
    const mine = new Set((here[table] || []).map(key))
    const theirs = new Set((t[table] || []).map(key))
    out.missing[table] = (t[table] || []).filter((r) => !mine.has(key(r))).map(label)
    out.extra[table] = (here[table] || []).filter((r) => !theirs.has(key(r))).map(label)
  }
  return out
}

/** Points a row's references at the station's rows, through `map` ({ table: { backupId: id } }). */
function repoint(table, row, map) {
  const to = (t, id) => (id && map[t]?.[id]) || id
  const out = { ...row }
  if (table === 'station_pumps') out.tank_id = to('station_tanks', row.tank_id)
  if (table === 'product_receipt_entries') out.tank_id = to('station_tanks', row.tank_id)
  if (table === 'lodgement_entries') out.bank_id = to('station_banks', row.bank_id)
  if (table === 'lube_sales_entries' || table === 'lube_stock_entries') out.product_id = to('station_lube_products', row.product_id)
  if (table === 'customer_payment_entries') out.customer_id = to('station_customers', row.customer_id)
  if (table === 'imprest_entries') out.imprest_period_id = to('imprest_periods', row.imprest_period_id)
  if (table === 'daily_sales_entries') {
    out.nozzle_readings = (row.nozzle_readings || []).map((r) => ({
      ...r,
      pump_id: to('station_pumps', r.pump_id),
      consumption_customer_id: to('station_customers', r.consumption_customer_id),
      pour_back_customer_id: to('station_customers', r.pour_back_customer_id),
    }))
    out.tank_readings = (row.tank_readings || []).map((r) => ({ ...r, tank_id: to('station_tanks', r.tank_id) }))
  }
  return out
}

/**
 * What to write: { puts: { table: rows }, deletes: { table: ids } }.
 *
 *   here       the station's rows now, by table
 *   stationId  the station open now
 *   newId      makes an id for each row put
 */
export function restoreIntoPlan({ backup, here, mode, stationId, newId }) {
  const t = backup?.tables || {}
  const puts = {}
  const deletes = {}
  const map = {}
  for (const table of RESTORE_TABLES) { puts[table] = []; deletes[table] = [] }

  if (mode === 'overwrite') {
    for (const table of RESTORE_TABLES) deletes[table] = (here[table] || []).map((r) => r.id)
  }

  for (const { table, key } of SETUP) {
    map[table] = {}
    const mine = mode === 'pad' ? new Map((here[table] || []).map((r) => [key(r), r.id])) : new Map()
    for (const row of t[table] || []) {
      const matched = mine.get(key(row))
      if (matched) { map[table][row.id] = matched; continue }
      const id = newId()
      map[table][row.id] = id
      puts[table].push({ ...row, id, org_id: stationId })
    }
  }
  for (const { table } of SETUP) puts[table] = puts[table].map((r) => repoint(table, r, map))

  for (const table of ENTRIES) {
    const taken = mode === 'pad' ? new Set((here[table] || []).map(dayOf)) : new Set()
    for (const row of t[table] || []) {
      if (taken.has(dayOf(row))) continue
      puts[table].push(repoint(table, { ...row, id: newId(), org_id: stationId }, map))
    }
  }
  return { puts, deletes }
}
