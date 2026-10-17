/**
 * Pins three layout asks:
 *
 *   The daily sales report fits a computer's width without scrolling sideways: the sections no
 *   longer hold a 700px minimum, and the stock column wraps beneath the pumps table when the two
 *   do not fit side by side (a phone may still scroll the pumps table).
 *
 *   The day's entry list has an "Edit" text button; Delete stays an icon.
 *
 *   Desktop build: the collapsed sidebar is twice its old 96px.
 *
 * Source is read rather than rendered, like tests/entry-order.test.mjs.
 *
 * Run: node tests/screen-fit.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(resolve(root, ...p), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('\nDaily sales report')
const report = read('screens', 'dashboard', 'reports', 'daily-sales-report', 'page.js')
check('no fixed 700px minimum', !report.includes('min-w-[700px]'))
check('the two sections wrap rather than sit in a fixed grid', report.includes('flex flex-wrap') && !report.includes('lg:grid-cols-[3fr_2fr]'))

console.log('\nEntries this day')
const list = read('components', 'entries', 'DayEntries.js')
check('Edit is a text button', />\s*Edit\s*</.test(list) && !list.includes('createOutline'))
check('Delete stays an icon', list.includes('trashOutline'))

const css = read('app', 'globals.css')
if (css.includes("data-house-side='collapsed'")) {
  console.log('\nDesktop sidebar')
  check('collapsed is 192px', /--side-width:\s*192px/.test(css) && /--side-max-width:\s*192px/.test(css) && !/--side-width:\s*96px/.test(css))
}

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
