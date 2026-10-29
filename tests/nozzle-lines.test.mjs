/**
 * Pins two nozzle layouts.
 *
 * Daily sales entry: the consumption and pour-back litres fields have the full cell; their
 * account buttons sit on the line under the nozzle row, shown once there are litres, each saying
 * what the litres are booked to ("Consumption: Mr Obi", "Pour back: add account").
 *
 * Summary report: each nozzle shows its opening and closing meter and what it dispensed.
 *
 * Run: node tests/nozzle-lines.test.mjs
 */
import { readFileSync } from 'node:fs'

let failures = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
  if (!ok) failures++
}
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

console.log('daily sales: account buttons on the line under the nozzle row')
{
  const src = read('screens/dashboard/entries/daily-sales/page.js')
  const field = src.slice(src.indexOf('const litresField'), src.indexOf('const accountButton'))
  const button = src.slice(src.indexOf('const accountButton'), src.indexOf('return (\n    <EntryScreen'))
  check('the litres field has no account button of its own', /<button/.test(field), false)
  check('the row cells hold only the litres fields', [/litresField\(idx, r, 'consumption'\)/.test(src), /litresField\(idx, r, 'pour_back'\)/.test(src), /litresWithAccount/.test(src)], [true, true, false])
  check('the button shows only once there are litres', /if \(!\(Number\(r\[field\]\) > 0\)\) return null/.test(button), true)
  check('it says what the litres are booked to, or add account', /\{word\}: \{custName \|\| 'add account'\}/.test(button), true)
  check('it opens the account sheet', /setConsModal\(\{ entryIdx: activeTab, nozzleIdx: idx, type \}\)/.test(button), true)
  check('it is a 44px tap target', /min-h-\[44px\]/.test(button), true)
  check('the line under the row holds both buttons', /\{accountButton\(idx, r, 'consumption'\)\}\n\s*\{accountButton\(idx, r, 'pour_back'\)\}/.test(src), true)
}

console.log('summary report: opening, closing and dispensed per nozzle')
{
  const src = read('screens/dashboard/reports/summary/page.js')
  const table = src.slice(src.indexOf('function ClosingReadings'))
  check('a heading per fuel names the columns', ['Opening', 'Closing', 'Dispensed'].map((h) => table.includes(`font-bold\`}>${h}</td>`)), [true, true, true])
  check('each nozzle row shows them', ['r.opening', 'r.closing', 'r.dispensed'].map((k) => table.includes(`{fmt(${k})}`)), [true, true, true])
  check('the total lines span the four columns', (table.match(/colSpan=\{4\}/g) || []).length, 2)
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1) }
console.log('\nall passed')
