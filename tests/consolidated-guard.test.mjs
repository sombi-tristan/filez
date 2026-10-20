/**
 * Pins the date before which entries are already consolidated (lib/consolidation.js): the
 * weekly job (consolidate_entries, migration 044, every Sunday 02:00 UTC) rolls entries older
 * than 90 days into the opening balances and deletes them. An entry for such a date that still
 * arrives (a phone or a computer offline for weeks) would count twice, so it is refused.
 *
 * Run: node tests/consolidated-guard.test.mjs
 */
import { existsSync } from 'node:fs'

const path = new URL('../lib/consolidation.js', import.meta.url)
const lib = existsSync(path) ? await import(path.href) : {}
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const at = (iso) => new Date(iso)

console.log('Consolidated before')
check('there is a helper', typeof lib.consolidatedBefore === 'function' && typeof lib.consolidatedEntryError === 'function')
if (lib.consolidatedBefore) {
  // Sunday 2026-10-18 02:00 UTC ran with cutoff CURRENT_DATE - 90 = 2026-07-20.
  check('after a Sunday run: that run\'s cutoff', lib.consolidatedBefore(at('2026-10-20T12:00:00Z')) === '2026-07-20')
  check('on Sunday after 02:00 UTC: today\'s run', lib.consolidatedBefore(at('2026-10-25T02:00:00Z')) === '2026-07-27')
  check('on Sunday before 02:00 UTC: still last week\'s', lib.consolidatedBefore(at('2026-10-25T01:59:00Z')) === '2026-07-20')
  check('on Saturday: last Sunday\'s', lib.consolidatedBefore(at('2026-10-24T23:59:00Z')) === '2026-07-20')
}

console.log('\nWhich entries are refused')
if (lib.consolidatedEntryError) {
  const now = at('2026-10-20T12:00:00Z')
  check('a day before the cutoff, in a consolidated table', /older than 3 months/.test(lib.consolidatedEntryError('daily_sales_entries', '2026-07-19', now) || ''))
  check('the error names the first date still open', (lib.consolidatedEntryError('lodgement_entries', '2026-07-19', now) || '').includes('2026-07-20'))
  check('the cutoff day itself is still open', lib.consolidatedEntryError('daily_sales_entries', '2026-07-20', now) === null)
  check('a table the job does not consolidate is never refused', lib.consolidatedEntryError('imprest_entries', '2020-01-01', now) === null && lib.consolidatedEntryError('consumption_entries', '2020-01-01', now) === null)
  check('no date, nothing to refuse', lib.consolidatedEntryError('daily_sales_entries', undefined, now) === null)
  check('all six of the job\'s tables', ['daily_sales_entries', 'product_receipt_entries', 'lodgement_entries', 'lube_sales_entries', 'lube_stock_entries', 'customer_payment_entries'].every((t) => lib.consolidatedEntryError(t, '2026-01-01', now)))
}

console.log('\nWho refuses them')
const { readFileSync } = await import('node:fs')
const src = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const push = src('../app/api/desktop/push/route.js')
check('the desktop push, before writing the row', /const old = consolidatedEntryError\(table, change\.row\?\.entry_date\)\s*if \(old\) \{ answer\(false, old\); continue \}/.test(push) && push.indexOf('consolidatedEntryError(table') < push.indexOf('.upsert(row)'))
check('a deletion of an old entry still goes through (it is gone here already)', push.indexOf("if (op === 'delete')") < push.indexOf('consolidatedEntryError(table'))
for (const [name, table] of [['daily-sales', 'daily_sales_entries'], ['product-receipt', 'product_receipt_entries'], ['lodgements', 'lodgement_entries'], ['lube-sales', 'lube_sales_entries'], ['lube-stock', 'lube_stock_entries'], ['customer-payments', 'customer_payment_entries']]) {
  const route = src(`../app/api/entries/${name}/route.js`)
  const guards = (route.match(/const old = consolidatedEntryError\(TABLE, (?:body\.)?entry_date\)\s*if \(old\) return NextResponse\.json\(\{ error: old \}, \{ status: 409 \}\)/g) || []).length
  check(`${name}: a new entry and a changed date are refused`, route.includes(`const TABLE = '${table}'`) && guards === 2)
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
