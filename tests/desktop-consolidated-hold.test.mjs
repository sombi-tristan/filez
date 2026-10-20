/**
 * Pins that a Push holds back entries the web has already consolidated (lib/consolidation.js,
 * the same rule as the web's, whose weekly job rolls entries older than 90 days into the opening
 * balances and deletes them). Sent, such an entry would count twice there. It stays waiting
 * here and is listed with the reason, as a row the web refuses is; a deletion still goes.
 *
 * Run: node tests/desktop-consolidated-hold.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const helperUrl = new URL('../lib/consolidation.js', import.meta.url)
const lib = existsSync(helperUrl) ? await import(helperUrl.href) : {}
const sync = readFileSync(new URL('../lib/local/webSync.js', import.meta.url), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('The rule, as on the web')
check('the helper is here', typeof lib.consolidatedEntryError === 'function')
if (lib.consolidatedEntryError) {
  const now = new Date('2026-10-20T12:00:00Z')
  check('the last Sunday run\'s cutoff', lib.consolidatedBefore(now) === '2026-07-20')
  check('an entry before it is held', /older than 3 months/.test(lib.consolidatedEntryError('daily_sales_entries', '2026-07-19', now) || ''))
  check('the cutoff day is not', lib.consolidatedEntryError('daily_sales_entries', '2026-07-20', now) === null)
  check('imprest and consumption never are', lib.consolidatedEntryError('imprest_entries', '2020-01-01', now) === null && lib.consolidatedEntryError('consumption_entries', '2020-01-01', now) === null)
}

console.log('\nPush')
check('uses the rule', sync.includes("import { consolidatedEntryError } from '@/lib/consolidation'"))
check('a held entry is not sent, and is listed with its reason', /const old = c\.op === 'upsert' && row \? consolidatedEntryError\(c\.table, row\.entry_date\) : null/.test(sync) && sync.includes('refused.push({ table: c.table, id: c.id, error: old })'))
check('it stays waiting (only what the web accepted is cleared)', sync.includes('await clearChanges(accepted)'))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
