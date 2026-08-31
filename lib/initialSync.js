import { db } from './db'
import { normalizeEntry, processQueue } from './sync'

// Bump this to force every device to run one fresh full backfill. Devices whose stored
// `synced:` record predates the current version are treated as un-synced and re-download,
// which is how already-corrupted mirrors (partial history) heal themselves on next open.
export const SYNC_VERSION = 3

/**
 * The station's configuration: nozzles, tanks, banks, credit accounts, lube products.
 *
 * Small, unpaginated, and reachable ONLY through initialSync — useRemoteChanges polls the six
 * entry tables and nothing else. That is why the pull below is not gated by the synced flag.
 */
const CONFIG_TABLES = [
  { api: 'nozzles',       table: 'nozzles',      key: 'nozzles' },
  { api: 'tanks',         table: 'tanks',        key: 'tanks' },
  { api: 'banks',         table: 'banks',        key: 'banks' },
  { api: 'customers',     table: 'customers',    key: 'customers' },
  { api: 'lube-products', table: 'lubeProducts', key: 'products' },
]

/**
 * Refresh the config tables for an org from the server.
 *
 * Only tables whose fetch SUCCEEDED are replaced. The old code substituted an empty list for
 * a failed response and then cleared the table anyway, so one transient 500 wiped the
 * station's setup out of the mirror and handed the user an empty entry form. Leaving a stale
 * table in place is the better failure: it is what the app was already running on.
 */
async function syncConfigTables(orgId) {
  const responses = await Promise.all(
    CONFIG_TABLES.map(({ api }) => fetch(`/api/entries/${api}?org_id=${orgId}`))
  )

  const fresh = []
  for (let i = 0; i < CONFIG_TABLES.length; i++) {
    const { api, table, key } = CONFIG_TABLES[i]
    const res = responses[i]

    // Customers must load successfully — otherwise reports show "Unknown" everywhere
    if (api === 'customers' && !res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(`initialSync: customers fetch failed (${res.status})${body.error ? `: ${body.error}` : ''}`)
    }

    if (!res.ok) continue
    const data = await res.json()
    fresh.push({ table, rows: data[key] || [] })
  }

  if (!fresh.length) return

  await db.transaction('rw', fresh.map(f => db[f.table]), async () => {
    for (const { table, rows } of fresh) {
      // Clear old data for this org before inserting fresh
      await db[table].where('orgId').equals(orgId).delete()
      if (rows.length) await db[table].bulkAdd(rows.map(r => ({ ...r, orgId })))
    }
  })
}

/**
 * Download all data for an org from the server into IndexedDB.
 * Called once after login or when switching stations.
 *
 * Config is refreshed on EVERY call; only the entry-history backfill is skipped when this org
 * was fully synced at the CURRENT SYNC_VERSION. Config used to sit behind the same flag, which
 * is why a station set up after a device first opened it never showed anything: the device had
 * already written `synced:<org>` over an empty station, so the nozzles, tanks and accounts the
 * setup wizard saved were never pulled and every entry screen read "No nozzles found". The
 * pull is five small requests and initialSync runs once per station visit.
 *
 * A partial history sync never writes the flag, and an older-version flag is ignored, so both
 * retry. Pass force=true to re-download everything.
 */
export async function initialSync(orgId, { force = false } = {}) {
  if (!orgId) return { skipped: true, reason: 'no-org-id' }

  await syncConfigTables(orgId)

  // Skip the history backfill only when a completed sync exists AT THE CURRENT VERSION.
  if (!force) {
    const meta = await db.syncMeta.get(`synced:${orgId}`)
    if (meta && meta.version === SYNC_VERSION) {
      return { skipped: true, reason: 'already-synced', configRefreshed: true }
    }
  }

  // Safety: flush pending sync queue before overwriting local data
  // This ensures locally-created entries reach the server first
  try { await processQueue() } catch (e) { /* offline — skip */ }

  // Fetch all entries for each type (paginate through everything)
  const entryTypes = [
    { api: 'daily-sales',       table: 'dailySales',       key: 'entries' },
    { api: 'product-receipt',   table: 'productReceipts',  key: 'entries' },
    { api: 'lodgements',        table: 'lodgements',       key: 'entries' },
    { api: 'lube-sales',        table: 'lubeSales',        key: 'entries' },
    { api: 'lube-stock',        table: 'lubeStock',        key: 'entries' },
    { api: 'customer-payments', table: 'customerPayments', key: 'entries' },
  ]

  const serverCounts = {}
  const failedTypes = []
  for (const { api, table, key } of entryTypes) {
    try {
      const allEntries = (await fetchAllPages(api, orgId))
        .filter(e => !e.deleted_at) // Exclude soft-deleted entries
      serverCounts[table] = allEntries.length

      if (allEntries.length) {
        await db.transaction('rw', db[table], async () => {
          await db[table].where('orgId').equals(orgId).delete()
          await db[table].bulkPut(
            allEntries.map(e => normalizeEntry(table, e, orgId))
          )
        })
      }
    } catch (err) {
      // A network/server error mid-pagination means we do NOT have the full history for this
      // type. Keep whatever came down as a cache, but record the failure so we do not mark the
      // org synced below — otherwise a partial mirror gets locked in and every cumulative /
      // opening-balance figure is computed over missing data, differently on each device.
      console.warn(`initialSync: ${api} incomplete, will retry`, err.message)
      serverCounts[table] = `error: ${err.message}`
      failedTypes.push(api)
    }
  }

  // Only mark synced when every type came down cleanly. If any type failed, leave the org
  // unmarked so the next initialSync retries and fills the gap.
  const complete = failedTypes.length === 0
  if (complete) {
    await db.syncMeta.put({ key: `synced:${orgId}`, syncedAt: Date.now(), version: SYNC_VERSION })
  }
  return { serverCounts, complete, failedTypes }
}

/**
 * Paginate through all entries for a given API type.
 */
async function fetchAllPages(apiType, orgId) {
  const all = []
  let page = 1
  const limit = 50

  while (true) {
    const url = `/api/entries/${apiType}?org_id=${orgId}&page=${page}&limit=${limit}`
    const res = await fetch(url)

    if (res.status === 403) break // No subscription for this type — legitimate skip
    // Any other non-OK response is a real failure. Do NOT treat it as "end of data": throw so
    // the caller knows this type is incomplete and must not be marked synced.
    if (!res.ok) throw new Error(`fetchAllPages(${apiType}): HTTP ${res.status} on page ${page}`)

    const data = await res.json()
    const entries = data.entries || []
    all.push(...entries)

    if (entries.length < limit) break // Last page
    page++
  }

  return all
}

/**
 * Clear all local data for an org (used on logout or station switch).
 */
export async function clearLocalData(orgId) {
  const tables = [
    db.dailySales, db.productReceipts, db.lodgements,
    db.lubeSales, db.lubeStock, db.customerPayments,
    db.nozzles, db.tanks, db.banks, db.customers, db.lubeProducts,
  ]

  await db.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.where('orgId').equals(orgId).delete()
    }
  })

  await db.syncMeta.delete(`synced:${orgId}`)
}
