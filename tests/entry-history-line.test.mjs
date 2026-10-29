/**
 * Pins the look of the who-and-when line under each saved entry (components/EntryHistory.js in
 * components/entries/DayEntries.js): small (11px), one line, never cut off with …, and on a line
 * of its own under the whole row, under Edit and Delete too, so a phone has room for it.
 *
 * Run: node tests/entry-history-line.test.mjs
 */
import { readFileSync } from 'node:fs'

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const line = read('components/EntryHistory.js')
const day = read('components/entries/DayEntries.js')

console.log('the who-and-when line')
check('11px', (line.match(/text-\[11px\]/g) || []).length === 2 && !/text-xs/.test(line))
check('one line, never cut off', line.includes('block whitespace-nowrap overflow-x-auto text-[11px]') && !line.includes('truncate'))
check('a row of its own, under Edit and Delete', /<li [^>]*flex flex-wrap/.test(day) && /trashOutline[\s\S]*?<span className="basis-full min-w-0 pl-8">\s*\{item\.entry \? <EntryHistory entry=\{item\.entry\} \/> : null\}/.test(day))

if (failures) { console.log(`\n${failures} failed`); process.exit(1) }
console.log('\nall passed')
