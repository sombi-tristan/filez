/**
 * Pins who added and who last edited each entry on the desktop, as on the web (migration 058,
 * components/EntryHistory.js there): the local store has updated_by on every entry table (from
 * the migrations, scripts/gen-local-schema.mjs), so a pull keeps it and a push sends it; the
 * local query builder joins it to a name; and every edit and delete here sets it.
 *
 * Run: node tests/desktop-entry-history.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => (existsSync(new URL(path, import.meta.url)) ? readFileSync(new URL(path, import.meta.url), 'utf8') : '')
const schema = JSON.parse(read('../lib/local/schema.json') || '{}')
const shim = read('../lib/local/supabase.js')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const TABLES = ['daily_sales_entries', 'product_receipt_entries', 'lodgement_entries', 'lube_sales_entries', 'lube_stock_entries', 'customer_payment_entries', 'imprest_entries']

console.log('The local store')
check('migration 058 is here, as on the web', read('../supabase/migrations/058_entry_updated_by.sql').includes('058: Who last changed an entry'))
for (const t of TABLES) check(`${t} has updated_by`, schema[t]?.columns?.includes('updated_by'))
check('updated_by joins to a user, as created_by does', /updated_by: 'users',/.test(shim))

console.log('\nThe local entry routes')
const WHO = 'users:created_by(name), editor:updated_by(name)'
const ROUTES = {
  'daily-sales': '../lib/local/routes/entries/daily-sales/route.js',
  'product-receipt': '../lib/local/routes/entries/product-receipt/route.js',
  lodgements: '../lib/local/routes/entries/lodgements/route.js',
  'lube-sales': '../lib/local/routes/entries/lube-sales/route.js',
  'lube-stock': '../lib/local/routes/entries/lube-stock/route.js',
  'customer-payments': '../lib/local/routes/entries/customer-payments/route.js',
  imprest: '../lib/local/routes/entries/imprest/entries/[id]/route.js',
}
for (const [name, path] of Object.entries(ROUTES)) {
  const src = read(path)
  check(`${name}: an edit sets who`, src.includes('const updates = { updated_at: new Date().toISOString(), updated_by: user.id }'))
  check(`${name}: a delete sets who`, src.includes('.update({ deleted_at: now, updated_at: now, updated_by: user.id })') && !src.includes('.update({ deleted_at: now, updated_at: now })'))
  if (name !== 'imprest') check(`${name}: the names come with the list and a save's reply`, !src.includes('.select()') && (src.match(new RegExp(WHO.replace(/[()]/g, '\\$&'), 'g')) || []).length === 4)
}

console.log('\nUnder each entry in the day\'s form, as on the web')
const syncLib = read('../lib/sync.js')
const base = syncLib.slice(syncLib.indexOf('export function normalizeEntry'), syncLib.indexOf('switch (table)', syncLib.indexOf('export function normalizeEntry')))
check('an entry keeps who added it and who last changed it, by name', base.includes('createdByName: serverRecord.users?.name || null') && base.includes('updatedBy: serverRecord.updated_by || null') && base.includes('updatedByName: serverRecord.editor?.name || null'))
const line = read('../components/EntryHistory.js')
check('the line under an entry', line.includes('export default function EntryHistory({ entry })') && line.includes('Added by ${entry.createdByName}') && line.includes('export function combineHistory('))
const day = read('../components/entries/DayEntries.js')
check('the day\'s list shows it', day.includes("import EntryHistory from '@/components/EntryHistory'") && day.includes('{item.entry ? <EntryHistory entry={item.entry} /> : null}'))
for (const form of ['daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments']) {
  const src = read(`../screens/dashboard/entries/${form}/page.js`)
  const lists = src.split('const listItems = ').slice(1).map((s) => s.slice(0, 600))
  const carries = form === 'product-receipt'
    ? lists.every((l) => l.includes('entry: combineHistory((dayRecords || []).filter((x) => r.ids.includes(x.id)))'))
    : lists.every((l) => /entry: e[,\s]/.test(l))
  check(`${form}: each item carries its entry`, lists.length > 0 && carries)
}

console.log('\nNames of people who only work on their phones')
const storeSrc = read('../lib/local/store.js')
const syncSrc = read('../lib/local/webSync.js')
check('a people table of names only, apart from users (nobody signs in with it)', /store\.version\(4\)\.stores\(\{[\s\S]*?people: 'id',/.test(storeSrc))
check('a pull keeps the names the web sends', syncSrc.includes('await keepPeople(res.body.people)') && /async function keepPeople\(people\) \{[\s\S]*?store\.people\.bulkPut\(people\.filter\(\(p\) => p && p\.id\)\.map\(\(\{ id, name \}\) => \(\{ id, name: name \|\| '' \}\)\)\)/.test(syncSrc))
check('a name not among the people signed in here is looked up there', /if \(rel\.table === 'users'\) \{[\s\S]*?loadAll\('people'\)[\s\S]*?if \(!byId\.has\(String\(p\.id\)\)\) byId\.set\(String\(p\.id\), p\)/.test(shim))

console.log('\nThe local query builder, on the real store')
{
  await import('fake-indexeddb/auto')
  const { mkdirSync, writeFileSync, copyFileSync } = await import('node:fs')
  const { fileURLToPath, pathToFileURL } = await import('node:url')
  const { resolve, dirname } = await import('node:path')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const tmp = resolve(root, 'node_modules', '.cache', 'desktop-entry-history-test')
  mkdirSync(tmp, { recursive: true })
  copyFileSync(resolve(root, 'lib', 'local', 'schema.json'), resolve(tmp, 'schema.json'))
  copyFileSync(resolve(root, 'lib', 'desktopTables.js'), resolve(tmp, 'desktopTables.mjs'))
  for (const name of ['store', 'session', 'outbox', 'supabase']) {
    const src = readFileSync(resolve(root, 'lib', 'local', `${name}.js`), 'utf8')
      .replace("import schema from './schema.json'", "import schema from './schema.json' with { type: 'json' }")
      .replace("from '@/lib/desktopTables'", "from './desktopTables.mjs'")
      .replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
    writeFileSync(resolve(tmp, `${name}.mjs`), src)
  }
  const storage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } }
  globalThis.localStorage ??= storage()
  globalThis.sessionStorage ??= storage()
  const { store } = await import(pathToFileURL(resolve(tmp, 'store.mjs')).href)
  const { localDb } = await import(pathToFileURL(resolve(tmp, 'supabase.mjs')).href)
  await store.users.bulkPut([{ id: 'ada', name: 'Ada' }, { id: 'musa', name: 'Musa' }])
  const added = await localDb.from('lodgement_entries')
    .insert({ org_id: 'kubwa', entry_date: '2026-10-20', amount: 5, created_by: 'ada' })
    .select(`*, ${WHO}`).single()
  check('a save\'s reply names who added it', added.data?.users?.name === 'Ada')
  const edited = await localDb.from('lodgement_entries')
    .update({ amount: 6, updated_by: 'musa' }).eq('id', added.data?.id)
    .select(`*, ${WHO}`).single()
  check('an edit\'s reply names who edited it', edited.data?.editor?.name === 'Musa' && edited.data?.users?.name === 'Ada')
  const listed = await localDb.from('lodgement_entries').select(`*, ${WHO}`).eq('org_id', 'kubwa')
  check('and so does the list', listed.data?.[0]?.editor?.name === 'Musa')
  await store.people.put({ id: 'ngozi', name: 'Ngozi' })
  const byPhone = await localDb.from('lodgement_entries')
    .insert({ org_id: 'kubwa', entry_date: '2026-10-20', amount: 7, created_by: 'ngozi' })
    .select(`*, ${WHO}`).single()
  check('someone who only works on a phone is named too', byPhone.data?.users?.name === 'Ngozi')
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
