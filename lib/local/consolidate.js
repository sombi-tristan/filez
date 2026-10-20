import { store } from './store'
import { consolidatedBefore, CONSOLIDATED_TABLES } from '@/lib/consolidation'

/**
 * Consolidation for a station on this computer only: the web's weekly job
 * (public.consolidate_entries, supabase/migrations/044 on the web) done here, for one station.
 * A linked station gets it from the web instead: its pull brings the new opening balances and
 * drops the entries the web removed.
 *
 * Entries dated before the cutoff of the last Sunday run (lib/consolidation.js, the same date
 * the web uses) roll into the opening balances, then are removed, with entries deleted over a
 * week ago:
 *   banks             + lodgements
 *   lube products     + units received less units sold
 *   customers         + sales less payments
 *   tanks             + product received, less what their pumps sold (closing meter above the
 *                       pump's opening reading, less pour back)
 *   pumps             opening reading moves to the highest old closing meter
 * Each gets the day after the cutoff as its opening date. One difference from the web: a pump
 * whose old readings have no closing meter keeps its opening reading (the SQL empties it).
 * All in one transaction, so a crash leaves the station as it was.
 */

const DAY = 24 * 60 * 60 * 1000
const num = (v) => Number(v) || 0
const dayAfter = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + DAY).toISOString().slice(0, 10)
const doneKey = (stationId) => `stationmgr.consolidated.${stationId}`

/** Adds `amount` per key to `column` of the station's rows in `table`, with the new opening date. */
async function addTo(table, column, totals, openingDate) {
  for (const [id, amount] of totals) {
    const row = await store[table].get(id)
    if (row) await store[table].update(id, { [column]: num(row[column]) + amount, opening_date: openingDate })
  }
}

function sumBy(rows, key, value) {
  const totals = new Map()
  for (const r of rows) if (r[key]) totals.set(r[key], (totals.get(r[key]) || 0) + value(r))
  return totals
}

/** Consolidates one station: { cutoff, removed }. */
export async function consolidateStation(stationId, now = new Date()) {
  const cutoff = consolidatedBefore(now)
  const openingDate = dayAfter(cutoff)
  const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString()
  const tables = [...CONSOLIDATED_TABLES, 'station_banks', 'station_lube_products', 'station_customers', 'station_tanks', 'station_pumps']

  return store.transaction('rw', tables.map((t) => store[t]), async () => {
    const old = async (table) => (await store[table].where('org_id').equals(stationId).toArray())
      .filter((r) => r.entry_date && r.entry_date < cutoff && !r.deleted_at)

    await addTo('station_banks', 'opening_balance', sumBy(await old('lodgement_entries'), 'bank_id', (r) => num(r.amount)), openingDate)
    await addTo('station_lube_products', 'opening_stock', sumBy(await old('lube_sales_entries'), 'product_id', (r) => num(r.unit_received) - num(r.unit_sold)), openingDate)
    await addTo('station_customers', 'opening_balance', sumBy(await old('customer_payment_entries'), 'customer_id', (r) => num(r.sales_amount) - num(r.amount_paid)), openingDate)
    await addTo('station_tanks', 'opening_stock', sumBy(await old('product_receipt_entries'), 'tank_id', (r) => num(r.actual_volume)), openingDate)

    // Pumps: the highest old closing meter and the pour back, per pump.
    const pumps = new Map()
    for (const entry of await old('daily_sales_entries')) {
      for (const nr of Array.isArray(entry.nozzle_readings) ? entry.nozzle_readings : []) {
        if (!nr?.pump_id) continue
        const p = pumps.get(nr.pump_id) || { maxMeter: null, pourBack: 0 }
        if (nr.closing_meter !== null && nr.closing_meter !== undefined && nr.closing_meter !== '') {
          p.maxMeter = p.maxMeter === null ? num(nr.closing_meter) : Math.max(p.maxMeter, num(nr.closing_meter))
        }
        p.pourBack += num(nr.pour_back)
        pumps.set(nr.pump_id, p)
      }
    }
    // What the pumps sold comes off their tanks, from the pumps' opening readings, before those move.
    const sold = new Map()
    for (const [pumpId, p] of pumps) {
      const pump = await store.station_pumps.get(pumpId)
      if (!pump?.tank_id) continue
      const litres = Math.max((p.maxMeter ?? 0) - num(pump.initial_reading), 0) - p.pourBack
      sold.set(pump.tank_id, (sold.get(pump.tank_id) || 0) + litres)
    }
    for (const [tankId, litres] of sold) {
      const tank = await store.station_tanks.get(tankId)
      if (tank && litres > 0) await store.station_tanks.update(tankId, { opening_stock: num(tank.opening_stock) - litres })
    }
    for (const [pumpId, p] of pumps) {
      if (p.maxMeter !== null && (await store.station_pumps.get(pumpId))) {
        await store.station_pumps.update(pumpId, { initial_reading: p.maxMeter, opening_date: openingDate })
      }
    }

    let removed = 0
    for (const table of CONSOLIDATED_TABLES) {
      const gone = (await store[table].where('org_id').equals(stationId).toArray())
        .filter((r) => (r.entry_date && r.entry_date < cutoff) || (r.deleted_at && r.deleted_at < weekAgo))
        .map((r) => r.id)
      if (gone.length) await store[table].bulkDelete(gone)
      removed += gone.length
    }
    return { cutoff, removed }
  })
}

/** When this station was last consolidated here: { cutoff, at, removed } or null. */
export function lastConsolidated(stationId) {
  try {
    return JSON.parse(localStorage.getItem(doneKey(stationId)) || 'null')
  } catch {
    return null
  }
}

function remember(stationId, value) {
  try {
    localStorage.setItem(doneKey(stationId), JSON.stringify(value))
  } catch {}
}

/**
 * Consolidates the station when a run is due (a new Sunday cutoff since the last): the result,
 * or null. A failure is kept with its message for the station card, and the run stays due.
 */
export async function consolidateIfDue(stationId, now = new Date()) {
  const cutoff = consolidatedBefore(now)
  if ((lastConsolidated(stationId)?.cutoff || '') >= cutoff) return null
  try {
    const result = await consolidateStation(stationId, now)
    remember(stationId, { ...result, at: now.toISOString() })
    return result
  } catch (err) {
    remember(stationId, { ...lastConsolidated(stationId), error: err.message, failedAt: now.toISOString() })
    throw err
  }
}
