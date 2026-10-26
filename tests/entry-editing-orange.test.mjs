/**
 * Pins the orange fields on a saved entry open for editing.
 *
 * Entry fields are filled blue (ENTRY_FILL). When a saved entry is opened to edit, its card is
 * titled "Editing …" and marked data-editing, and its fields turn house orange (#f57d00), so it
 * is plain that a saved entry is being changed. A new entry stays blue.
 *
 * Run: node tests/entry-editing-orange.test.mjs
 */
import { readFileSync } from 'node:fs'

let failures = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
  if (!ok) failures++
}
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const ui = read('components/ui/index.js')
const parts = read('components/entries/EntryParts.js')
const css = read('app/globals.css')

console.log('orange while editing')
check('ENTRY_FILL carries the entry-fill mark', /export const ENTRY_FILL = 'entry-fill /.test(ui), true)
check('ENTRY_FILL_WITHIN carries the entry-fill-within mark', /export const ENTRY_FILL_WITHIN = 'entry-fill-within /.test(ui), true)
check('EntryCard is data-editing when its title starts with Editing', /const editing = \/\^Editing\\b\/\.test\(title/.test(parts) && /data-editing=\{editing \|\| undefined\}/.test(parts), true)
check('editing fields rest in house orange', /\[data-editing\] \.entry-fill,\n\[data-editing\] \.entry-fill-within \{\n  background-color: rgb\(245 125 0 \/ 0\.12\);/.test(css), true)
check('and deepen on focus', /\[data-editing\] \.entry-fill:focus,[\s\S]*?\[data-editing\] \.entry-fill-within:focus-within \{\n  background-color: rgb\(245 125 0 \/ 0\.26\);/.test(css), true)
for (const page of ['customer-payments', 'daily-sales', 'lodgements', 'lube', 'product-receipt']) {
  const src = read(`screens/dashboard/entries/${page}/page.js`)
  check(`${page}: the card is titled Editing … when a saved entry is open`, /<EntryCard[^>]*title=\{isEditing \? 'Editing /.test(src), true)
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1) }
console.log('\nall passed')
