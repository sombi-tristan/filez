/**
 * Reproduces the "entries reorder when saved and reopened" bug and pins the fix, across EVERY
 * multi-entry page rather than just daily-sales.
 *
 * The bug has two halves, and a page is only correct if it has both:
 *
 *   Save side. All entries in one batch were stamped with a single `new Date().toISOString()`,
 *   so createdAt tied and could not express order. orderedCreatedAt(baseMs, i) gives each a
 *   distinct, strictly increasing timestamp by its position in the form.
 *
 *   Load side. A day's entries were gathered with a plain filter and no sort, so they came back
 *   in whatever order the store returned them. The loader has to sort by createdAt.
 *
 * Fixing only one half does nothing: distinct timestamps that nobody sorts by still reopen
 * scattered, and a sort over tied timestamps is still arbitrary. So both are asserted per page.
 *
 * Source is read and evaluated rather than imported, so the test cannot drift from the
 * implementation. Was tests/daily-sales-order.test.mjs, when daily-sales was the only page
 * covered.
 *
 * Run: node tests/entry-order.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const src = readFileSync(resolve(root, 'lib', 'entryOrder.js'), 'utf8').replace(/export\s+/g, '')
const { orderedCreatedAt } = new Function(`${src}\nreturn { orderedCreatedAt }`)()

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures++
}

const BASE = 1_700_000_000_000

// ---- the helper itself -----------------------------------------------------------------
console.log('\nentry ordering: the helper')

// The bug condition: one shared timestamp for the whole batch ties on createdAt.
const shared = ['a', 'b', 'c'].map(() => new Date(BASE).toISOString())
check('a shared-timestamp save ties on createdAt (the bug condition)', new Set(shared).size === 1)

const stamped = ['a', 'b', 'c'].map((id, i) => ({ id, pos: i, createdAt: orderedCreatedAt(BASE, i) }))
check('orderedCreatedAt yields distinct timestamps', new Set(stamped.map((e) => e.createdAt)).size === 3)
check('timestamps strictly increase with position', stamped.every((e, i) => i === 0 || e.createdAt > stamped[i - 1].createdAt))

const shuffled = [stamped[2], stamped[0], stamped[1]]
const resorted = [...shuffled].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
check('sorting by createdAt restores the arranged order', resorted.map((e) => e.pos).join(',') === '0,1,2')

// ---- every multi-entry page ------------------------------------------------------------
// These pages all stack numbered entries behind one Save, so all of them can reorder.
const PAGES = ['daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments']

console.log('\nentry ordering: every multi-entry page')

for (const page of PAGES) {
  const file = resolve(root, 'screens', 'dashboard', 'entries', page, 'page.js')
  const code = readFileSync(file, 'utf8')

  // Save side: the batch must stamp positions, not one shared `now`.
  const usesHelper = /orderedCreatedAt\s*\(/.test(code) && /from '@\/lib\/entryOrder'/.test(code)
  check(`${page}: stamps distinct createdAt on save`, usesHelper)

  // A page that still assigns the batch timestamp directly has not been converted.
  const sharedStamp = /record\.createdAt\s*=\s*now\b/.test(code) || /createdAt:\s*now\b/.test(code)
  check(`${page}: no shared-timestamp assignment left`, !sharedStamp)

  // Load side: reopening a day must sort by createdAt, via the shared comparator.
  const importsComparator = /byCreatedAt/.test(code) && /from '@\/lib\/entryOrder'/.test(code)
  check(`${page}: imports the shared comparator`, importsComparator)

  // Every place a day's entries are gathered has to sort, not just the edit branch: there is
  // also the create-mode "load today" path and handleDateChange. An unsorted one reopens
  // scattered exactly like the original bug.
  //
  // Matched on the `dateEntries` binding and the lines that follow it, rather than on the
  // shape of the filter, because the pages spell that differently: some are one line, and
  // daily-sales breaks the chain across three.
  //
  // Only the gathers that FEED THE FORM count. daily-sales also reads the day's records to
  // check for a duplicate close-of-business entry, and that one is a `.find()` whose result
  // order cannot matter. The invariant is about lists that become the on-screen entries, so
  // the window has to reach `setEntries` for a site to qualify.
  const lines = code.split('\n')
  const gathers = []
  lines.forEach((line, idx) => {
    if (!/const dateEntries\s*=/.test(line)) return
    const window = lines.slice(idx, idx + 14).join('\n')
    if (window.includes('setEntries(')) gathers.push(lines.slice(idx, idx + 5).join('\n'))
  })
  const unsorted = gathers.filter((chunk) => !chunk.includes('.sort(byCreatedAt)'))
  check(
    `${page}: every day-entry load sorts (${gathers.length} found)`,
    gathers.length > 0 && unsorted.length === 0,
    unsorted.length ? `${unsorted.length} unsorted` : ''
  )
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`)
process.exit(failures === 0 ? 0 : 1)
