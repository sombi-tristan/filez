/**
 * Reproduces the "works on my device, wrong figures for everyone else" bug.
 *
 * station-portal computes every report in the browser from a local Dexie mirror. That mirror
 * is filled by initialSync(), which paginates the whole history down. The defect: fetchAllPages
 * treats ANY failed page fetch as "end of data" (it just `break`s and returns what it has), and
 * initialSync then writes the `synced:<org>` flag regardless. On a flaky phone connection the
 * first sync truncates part-way, gets marked "complete", and never re-runs — so cumulative and
 * opening-balance figures are computed over a partial history, differently on every device.
 *
 * These tests pin the contract:
 *   1. A clean run pulls the FULL history and marks the org synced.
 *   2. A mid-pagination network/server failure must NOT mark the org synced (so it retries).
 *   3. A per-type 403 (no subscription for that entry type) is a legitimate skip, not a
 *      truncation — the sync still completes and marks synced.
 *
 * Test 2 fails against the current code (the bug); the fix makes it pass without breaking 1 or 3.
 *
 * The real initialSync source is loaded and its dependencies (db, fetch, processQueue,
 * normalizeEntry) are injected, so this test cannot drift from the implementation.
 *
 * Run: node tests/initial-sync-completeness.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load the real initialSync module with its imports stripped and deps injected ──
let code = readFileSync(resolve(__dirname, '..', 'lib', 'initialSync.js'), 'utf8')
code = code.replace(/^\s*import[^\n]*\n/gm, '')   // drop ESM imports
code = code.replace(/^\s*export\s+/gm, '')        // drop export keyword (const + functions)
const loadModule = (deps) =>
  new Function(
    'db', 'fetch', 'processQueue', 'normalizeEntry',
    `${code}\n;return { initialSync, fetchAllPages, clearLocalData, SYNC_VERSION };`
  )(deps.db, deps.fetch, deps.processQueue, deps.normalizeEntry)

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

// ── In-memory Dexie stand-ins ──
function makeTable() {
  const store = new Map()
  const rows = () => [...store.values()]
  return {
    store,
    async bulkAdd(list) { for (const r of list) store.set(r.id, r) },
    async bulkPut(list) { for (const r of list) store.set(r.id, r) },
    async put(r) { store.set(r.id, r) },
    async get(id) { return store.get(id) },
    async count() { return store.size },
    where(field) {
      return {
        equals(val) {
          const match = () => rows().filter((r) => r[field] === val)
          return {
            async delete() { for (const [k, v] of store) if (v[field] === val) store.delete(k) },
            async toArray() { return match() },
            async count() { return match().length },
          }
        },
      }
    },
  }
}

function makeMeta() {
  const store = new Map()
  return {
    store,
    async get(key) { return store.get(key) },
    async put(obj) { store.set(obj.key, obj) },
    async delete(key) { store.delete(key) },
  }
}

const ENTRY_TABLES = ['dailySales', 'productReceipts', 'lodgements', 'lubeSales', 'lubeStock', 'customerPayments']
const CONFIG_TABLES = ['nozzles', 'tanks', 'banks', 'customers', 'lubeProducts']

function makeDb() {
  const db = { syncMeta: makeMeta() }
  for (const t of [...ENTRY_TABLES, ...CONFIG_TABLES]) db[t] = makeTable()
  db.transaction = async (_mode, _tables, fn) => fn() // stub — just run the body
  return db
}

// ── Fetch mock: config tables + paginated entry endpoints, with an optional forced failure ──
const CONFIG_KEY = { nozzles: 'nozzles', tanks: 'tanks', banks: 'banks', customers: 'customers', 'lube-products': 'products' }

function makeFetch({ serverData = {}, failOn = null, throwOn = null } = {}) {
  return async (url) => {
    const u = new URL(url, 'http://x')
    const seg = u.pathname.split('/').pop()
    if (seg in CONFIG_KEY) {
      if (failOn && failOn.api === seg) {
        const status = failOn.status || 500
        return { ok: false, status, async json() { return { error: 'boom' } } }
      }
      const body = { [CONFIG_KEY[seg]]: serverData[seg] || [] }
      return { ok: true, status: 200, async json() { return body } }
    }
    const page = Number(u.searchParams.get('page') || 0)
    const limit = Number(u.searchParams.get('limit') || 50)
    if (throwOn && throwOn.api === seg && throwOn.page === page) {
      throw new TypeError('Failed to fetch') // phone dropped signal mid-pagination
    }
    if (failOn && failOn.api === seg && failOn.page === page) {
      const status = failOn.status || 500
      return { ok: false, status, async json() { return { error: 'boom' } } }
    }
    const all = serverData[seg] || []
    const slice = all.slice((page - 1) * limit, (page - 1) * limit + limit)
    return { ok: true, status: 200, async json() { return { entries: slice } } }
  }
}

const gen = (n, pfx) => Array.from({ length: n }, (_, i) => ({ id: `${pfx}${i}`, entry_date: '2026-07-01' }))
const deps = (fetchImpl) => ({
  db: makeDb(),
  fetch: fetchImpl,
  processQueue: async () => ({}),
  normalizeEntry: (_table, e, orgId) => ({ ...e, orgId }),
})

const ORG = 'org_1'
// 120 daily-sales spans 3 pages of 50 — enough for pagination to fail part-way.
const serverData = {
  'daily-sales': gen(120, 'ds'),
  'product-receipt': gen(5, 'pr'),
  lodgements: gen(10, 'lg'),
  'lube-sales': gen(3, 'ls'),
  'lube-stock': gen(3, 'lk'),
  'customer-payments': gen(4, 'cp'),
}

// 1) Clean run: full history down, org marked synced.
console.log('\n1. clean run pulls the full history and marks synced')
{
  const d = deps(makeFetch({ serverData }))
  const mod = loadModule(d)
  const result = await mod.initialSync(ORG)
  check('all 120 daily-sales landed locally', (await d.db.dailySales.count()) === 120, `local=${await d.db.dailySales.count()}`)
  check('all 10 lodgements landed locally', (await d.db.lodgements.count()) === 10)
  check('serverCounts reflects the full set', result?.serverCounts?.dailySales === 120, `count=${result?.serverCounts?.dailySales}`)
  check('org is marked synced', !!(await d.db.syncMeta.get(`synced:${ORG}`)))
}

// 2) THE BUG: a page fetch fails mid-pagination. The org must NOT be marked synced.
console.log('\n2. a mid-pagination failure must not lock in a partial mirror')
{
  const d = deps(makeFetch({ serverData, failOn: { api: 'daily-sales', page: 2, status: 500 } }))
  const mod = loadModule(d)
  let threw = false
  try { await mod.initialSync(ORG) } catch { threw = true }

  const local = await d.db.dailySales.count()
  const marked = !!(await d.db.syncMeta.get(`synced:${ORG}`))
  check('org is NOT marked synced after a failed sync (so it will retry)', marked === false,
    `marked=${marked}, localDailySales=${local}, threw=${threw}`)
  check('did not silently persist a full-looking mirror', local < 120, `local=${local}`)
}

// 2b) The real field trigger: the connection drops (fetch rejects) mid-pagination.
console.log('\n2b. a dropped connection mid-pagination must not lock in a partial mirror')
{
  const d = deps(makeFetch({ serverData, throwOn: { api: 'daily-sales', page: 2 } }))
  const mod = loadModule(d)
  try { await mod.initialSync(ORG) } catch { /* propagating is fine */ }
  check('org is NOT marked synced after a dropped connection', !(await d.db.syncMeta.get(`synced:${ORG}`)))
}

// 3) A per-type 403 (no subscription) is a legitimate skip, not a failure.
console.log('\n3. a per-type 403 is a legitimate skip and still completes')
{
  const d = deps(makeFetch({ serverData, failOn: { api: 'lube-sales', page: 1, status: 403 } }))
  const mod = loadModule(d)
  await mod.initialSync(ORG)
  check('org IS marked synced (403 is not a truncation)', !!(await d.db.syncMeta.get(`synced:${ORG}`)))
  check('the un-subscribed type is simply empty', (await d.db.lubeSales.count()) === 0)
  check('other types still synced fully', (await d.db.dailySales.count()) === 120)
}

// 4) Self-heal: a device carrying a version-less (old) synced flag re-runs a full sync.
console.log('\n4. an old/version-less synced flag re-runs a full backfill (heals partial mirrors)')
{
  const d = deps(makeFetch({ serverData }))
  // Simulate an already-"synced" device from before the fix: flag present, no version.
  await d.db.syncMeta.put({ key: `synced:${ORG}`, syncedAt: 1 })
  const mod = loadModule(d)
  const result = await mod.initialSync(ORG)
  check('did NOT skip (stale version is ignored)', result?.skipped !== true, `reason=${result?.reason}`)
  check('re-pulled the full history', (await d.db.dailySales.count()) === 120, `local=${await d.db.dailySales.count()}`)
  const meta = await d.db.syncMeta.get(`synced:${ORG}`)
  check('flag rewritten at the current SYNC_VERSION', meta?.version === mod.SYNC_VERSION, `version=${meta?.version}`)
}

// 5) A device already synced at the current version skips (no needless refetch).
console.log('\n5. a device synced at the current version skips the history backfill')
{
  const d = deps(makeFetch({ serverData }))
  const mod = loadModule(d)
  await d.db.syncMeta.put({ key: `synced:${ORG}`, syncedAt: 1, version: mod.SYNC_VERSION })
  const result = await mod.initialSync(ORG)
  check('skips as already-synced', result?.skipped === true && result?.reason === 'already-synced', `result=${JSON.stringify(result)}`)
  check('did not refetch (mirror stays empty)', (await d.db.dailySales.count()) === 0)
}
// ── Config tables ──────────────────────────────────────────────────────────────────────────
//
// Nozzles, tanks, banks, customers and lube products reach the mirror ONLY through
// initialSync — useRemoteChanges polls the six entry tables and nothing else. So while the
// history backfill is rightly gated by the synced flag, the config pull must not be: a
// station set up AFTER a device first opened it would otherwise never see its own nozzles,
// and every entry screen reads "No nozzles found" forever.

const configData = {
  nozzles: [{ id: 'n1', fuel_type: 'PMS', pump_number: 1 }, { id: 'n2', fuel_type: 'AGO', pump_number: 2 }],
  tanks: [{ id: 't1', fuel_type: 'PMS', tank_number: 1 }],
  banks: [{ id: 'b1', bank_name: 'GTB' }],
  customers: [{ id: 'c1', name: 'Walk-in' }],
  'lube-products': [{ id: 'p1', product_name: 'Engine Oil' }],
}

// 6) THE BUG: setup runs after the device already synced, so the flag is set and the config
//    pull was being skipped along with the history.
console.log('\n6. an already-synced device still picks up config saved after that sync')
{
  const d = deps(makeFetch({ serverData: { ...serverData, ...configData } }))
  const mod = loadModule(d)
  // Device opened the station before setup: synced at the current version, mirror empty.
  await d.db.syncMeta.put({ key: `synced:${ORG}`, syncedAt: 1, version: mod.SYNC_VERSION })

  await mod.initialSync(ORG)

  check('nozzles landed locally', (await d.db.nozzles.count()) === 2, `local=${await d.db.nozzles.count()}`)
  check('tanks landed locally', (await d.db.tanks.count()) === 1)
  check('banks landed locally', (await d.db.banks.count()) === 1)
  check('customers landed locally', (await d.db.customers.count()) === 1)
  check('lube products landed locally', (await d.db.lubeProducts.count()) === 1)
  check('the history backfill is still skipped', (await d.db.dailySales.count()) === 0,
    `local=${await d.db.dailySales.count()}`)
}

// 7) A config endpoint that fails must leave what is already local alone. Refreshing config
//    on every call means a transient 500 would otherwise wipe the station's setup from the
//    mirror and hand the user an empty entry form.
console.log('\n7. a failed config fetch leaves the existing local config alone')
{
  const d = deps(makeFetch({ serverData: { ...serverData, ...configData }, failOn: { api: 'nozzles', status: 500 } }))
  const mod = loadModule(d)
  await d.db.nozzles.bulkAdd([{ id: 'n1', orgId: ORG, fuel_type: 'PMS', pump_number: 1 }])
  await d.db.syncMeta.put({ key: `synced:${ORG}`, syncedAt: 1, version: mod.SYNC_VERSION })

  try { await mod.initialSync(ORG) } catch { /* a throw is acceptable; a wipe is not */ }

  check('the local nozzle survived the failed fetch', (await d.db.nozzles.count()) === 1,
    `local=${await d.db.nozzles.count()}`)
}

// 8) Customers are the one config table whose failure must be loud: reports label every row
//    off them, so a silent empty set shows "Unknown" everywhere.
console.log('\n8. a failed customers fetch still throws')
{
  const d = deps(makeFetch({ serverData: { ...serverData, ...configData }, failOn: { api: 'customers', status: 500 } }))
  const mod = loadModule(d)
  let threw = false
  try { await mod.initialSync(ORG) } catch { threw = true }
  check('initialSync throws so the caller retries', threw)
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
