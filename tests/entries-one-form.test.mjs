/**
 * Pins the entry screens' layout: one form, with the day's saved entries listed beside it on a
 * computer and beneath it on a phone (components/entries/DayEntries.js). Each entry in the list
 * can be edited (loaded into the form) and deleted, on every entry type.
 *
 * Read from source: each screen lists the day with DayEntries, deletes through its own
 * repository's remove (so the deletion is queued for sync like any other), and no longer stacks
 * forms (no "Add another entry", no entry tabs).
 *
 * Run: node tests/entries-one-form.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const SCREENS = {
  'daily-sales': ['dailySalesRepo'],
  lodgements: ['lodgementsRepo'],
  'product-receipt': ['productReceiptsRepo'],
  lube: ['lubeSalesRepo', 'lubeStockRepo'],
  'customer-payments': ['customerPaymentsRepo'],
}

for (const [screen, repos] of Object.entries(SCREENS)) {
  console.log(screen)
  const code = readFileSync(resolve(root, 'screens', 'dashboard', 'entries', screen, 'page.js'), 'utf8')
  check('lists the day beside the one form', code.includes('<EntryWithDayList') && code.includes('<DayEntries'))
  check('edits an entry by loading it into the form', /const editEntry = /.test(code) && code.includes('onEdit={editEntry}'))
  check('deletes an entry through its repository', repos.every((r) => code.includes(`${r}.remove(`)) && code.includes('onDelete={deleteEntry}'))
  check('no stacked forms', !code.includes('AddEntryButton') && !code.includes('<EntryTabs'))
  check('clears the form after saving, staying on the screen', code.includes('clearForm()') && !/promptPush\(\(\) => router\.push/.test(code))
}

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
