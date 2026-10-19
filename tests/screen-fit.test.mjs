/**
 * Pins three layout asks:
 *
 *   The daily sales report is two columns side by side on a computer (pumps on the left, stock and
 *   summary on the right) and never scrolls sideways there: no 700px minimum, and a long figure
 *   wraps inside its cell instead (a phone, one column, may still scroll the pumps table).
 *
 *   The day's entry list has an "Edit" text button; Delete stays an icon.
 *
 *   Desktop build: the collapsed sidebar's width outranks design/house.css's 72px. app/layout.js
 *   loads house.css after globals.css, so the same selector here loses and the width never changes.
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
check('two columns side by side on a computer', report.includes('lg:grid-cols-[3fr_2fr]') && !report.includes('flex-[3_1_44rem]'))
check('no sideways scroll on a computer', report.includes('lg:overflow-x-hidden') && report.includes('lg:[overflow-wrap:anywhere]'))

console.log('\nEntries this day')
const list = read('components', 'entries', 'DayEntries.js')
check('Edit is a text button', />\s*Edit\s*</.test(list) && !list.includes('createOutline'))
check('Delete stays an icon', list.includes('trashOutline'))
// A sticky top below the date box's own (DayBar: sticky top-0, the box 8px into its py-2 band)
// pushes the list down even before any scroll: at top-20 it started 60px below the date box.
check('the list starts and sticks level with the date box', list.includes('lg:mt-2 lg:sticky lg:top-2') && !list.includes('lg:top-20'))

console.log('\nConsumption, pour back and totals')
{
  const right = report.slice(report.indexOf('{/* ===== RIGHT: STOCK & SUMMARY ===== */}'), report.indexOf('{/* ===== BELOW: BALANCES, THEN CONSUMPTION, POUR BACK, TOTALS ===== */}'))
  const below = report.slice(report.indexOf('{/* ===== BELOW: BALANCES, THEN CONSUMPTION, POUR BACK, TOTALS ===== */}'), report.indexOf('{/* Day tabs'))
  const totalsBox = below.slice(below.indexOf('{/* The totals table */}'))
  const balancesBox = below.slice(below.indexOf('{/* The balances table */}'), below.indexOf('{/* The totals table */}'))
  check('no longer in the right-hand column', right.length > 0 && !right.includes('>Consumption<') && !right.includes('>Pour Back<') && !right.includes('>Balances<') && !right.includes('>TOTAL POS<'))
  check('under both columns, the totals one table: Consumption, Pour Back, then Totals', (totalsBox.match(/<table/g) || []).length === 1 &&
    totalsBox.indexOf("section('Consumption'") > 0 && totalsBox.indexOf("section('Consumption'") < totalsBox.indexOf("section('Pour Back'") && totalsBox.indexOf("section('Pour Back'") < totalsBox.indexOf('>Totals<') &&
    totalsBox.includes('>TOTAL POS<') && totalsBox.includes('>CASH<') && !totalsBox.includes('>Balances<'))
  check('Balances is a box of its own, after the divider and before the totals', (balancesBox.match(/<table/g) || []).length === 1 && balancesBox.includes('>Balances<') &&
    below.indexOf('<hr ') < below.indexOf('{/* The balances table */}') && below.indexOf('{/* The balances table */}') < below.indexOf('{/* The totals table */}'))
  check('one row of two boxes on a computer, Balances then Totals; stacked on a phone', below.includes('<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4 lg:[overflow-wrap:anywhere]">') &&
    (balancesBox.match(/<div className="min-w-0 empty:hidden lg:empty:block">/g) || []).length === 1 && (totalsBox.match(/<div className="min-w-0">/g) || []).length === 1)
  check('a divider sets them apart from the rest of the report', /<hr className="my-4 border-t-2 border-primary-500\/40 dark:border-primary-400\/40" \/>\s*<div className="grid grid-cols-1 lg:grid-cols-2/.test(below))
}

console.log('\nStock table')
check('its Dispensed heading is Disp.', /OV\/SH<\/th>/.test(report) && /<th[^>]*>Disp\.<\/th>\s*<th[^>]*>OV\/SH<\/th>/.test(report))
check('the pumps table keeps Dispensed, and Consumed is Cons', /<th[^>]*>Dispensed<\/th>\s*<th[^>]*>Cons<\/th>/.test(report) && !report.includes('>Consumed<'))

console.log('\nReport frame')
check('4px between the frame and the report inside it', /export const REPORT_CARD = `[^`]*\bp-1\b/.test(read('components', 'ui', 'index.js')))

console.log('\nStation home entry widgets')
const home = read('screens', 'dashboard', 'stations', '[stationId]', 'page.js')
const tiles = home.slice(home.indexOf('{entryLinks.length > 0 && ('), home.indexOf('{/* Reports: the six'))
check('no fixed squares', !tiles.includes('aspect-square') && !tiles.includes('w-36 h-36'))
check('icon on top, name under it, centred', tiles.includes('flex-col items-center justify-center') && tiles.includes('text-center'))
check('a short description under the name, two lines at most', /<p className="[^"]*line-clamp-2[^"]*">\{link\.desc\}<\/p>/.test(tiles))
// The design the owner pointed at: a white panel with its heading inside, pale borderless tiles,
// the whole section in the middle of the page.
check('a white panel, its heading inside, full width', /<section className="w-full bg-surface border-card border-line rounded-house p-3">\s*<h2[^>]*>Entries<\/h2>/.test(tiles))
check('pale tiles with no line', /const cls = `w-full h-28[^`]*bg-subtle rounded-house[^`]*`/.test(tiles) && !/const cls = `[^`]*\$\{CARD\}/.test(tiles))
check('a soft blue round icon', tiles.includes('<IconChip icon={link.icon} className="w-10 h-10"'))

check('tiles fill the row in equal columns, 112px tall', tiles.includes('<div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">') && /const cls = `w-full h-28 flex flex-col items-center justify-center[^`]*text-center bg-subtle rounded-house/.test(tiles))

console.log('\nReport screens on a computer')
// The gap beside the sidebar was the wrapper's 24px side padding, and a 1200px cap centred it.
for (const name of ['audit-report', 'daily-sales-report', 'inventory-log', 'lube-report', 'product-received', 'sales-overview', 'summary', 'sales-operation']) {
  const src = read('screens', 'dashboard', 'reports', name, 'page.js')
  check(`${name}: 8px beside the sidebar, full width`, /h-\[calc\(100dvh-3\.5rem\)\] max-w-\[1200px\] lg:max-w-none mx-auto px-[24] sm:px-6 lg:px-2/.test(src))
}

console.log('\nWallet')
const wallet = read('components', 'StationWallet.js')
check('a solid blue card, no line', /<div className="relative bg-primary-600 text-white rounded-house mb-4">/.test(wallet))
check('the station\'s initial on a round badge', wallet.includes('station.name?.[0]') && /rounded-full bg-white\/20/.test(wallet))
check('Push and Pull are round white buttons', /const roundBtn = '[^']*w-11 h-11 rounded-full bg-white text-primary-600/.test(wallet) && (wallet.match(/className=\{roundBtn\}/g) || []).length === 2)
check('Push and Pull say what they are', wallet.includes('aria-label="Push"') && wallet.includes('aria-label="Pull"'))
check('a lighter band at the bottom with the times as chips', /bg-white\/15 rounded-house/.test(wallet) && wallet.includes('Pushed ') && wallet.includes('Pulled '))
check('Review is a chip in the band', /onClick=\{\(\) => setReviewing\(true\)\}[^>]*className=\{`\$\{chip\}/.test(wallet))

const css = read('app', 'globals.css')
if (css.includes("data-house-side='collapsed'")) {
  console.log('\nDesktop sidebar')
  check('collapsed is 100px', /--side-width:\s*100px/.test(css) && /--side-min-width:\s*100px/.test(css) && /--side-max-width:\s*100px/.test(css))
  check('the rule outranks house.css (not its very selector)', !/html\[data-house-side='collapsed'\] ion-split-pane\s*\{/.test(css))
  check('the framed column scrolls, not the IonContent holding it', /ion-menu ion-content\s*\{\s*--overflow:\s*hidden/.test(css) && /ion-menu \.house-side\s*\{[^}]*overflow-y:\s*auto/.test(css))
}

console.log('\nEntry and report text')
check('every word bold', /\.screen-larger \*\s*\{\s*font-weight:\s*700/.test(css))
check('what was bold turns Premeval orange', css.includes(':is(.font-bold, .font-semibold') && /\.screen-larger\s*\{\s*--bold-ink:\s*#f57d00/.test(css))
check('labels are blue (label, and the blue-grey label text)', /\.screen-larger :is\(label, \.text-content-muted, \.text-content-faint\)\s*\{\s*color:\s*rgb\(var\(--primary-700\)\)/.test(css) && /\[data-theme='dark'\] \.screen-larger :is\(label, \.text-content-muted, \.text-content-faint\)\s*\{\s*color:\s*rgb\(var\(--primary-200\)\)/.test(css))
check('and never orange, totals still are', ["label, label *", "[class*='text-content-muted'], [class*='text-content-faint']"].every((s) => css.includes(s)))
const shell = read('components', 'shell', 'Screen.js')
check('entry screens are not set apart: their bold text is orange too', !shell.includes('screen-entries') && !css.includes('screen-entries'))
check('the day\'s entries list is marked', /<section className="entries-list /.test(list))
check('and its text is blue, bold or not', /\.entries-list\s*\{\s*color:\s*rgb\(var\(--primary-700\)\);\s*--bold-ink:\s*rgb\(var\(--primary-700\)\)/.test(css) && /\[data-theme='dark'\] \.entries-list\s*\{\s*color:\s*rgb\(var\(--primary-200\)\);\s*--bold-ink:\s*rgb\(var\(--primary-200\)\)/.test(css) && /\)\s*\{\s*color:\s*var\(--bold-ink\)/.test(css))
// Dark mode: every blue text one step brighter (buttons, report subheads, links), fills untouched.
const dark = css.slice(css.indexOf('/* Dark mode: blue text one step brighter'))
check('dark blue text is one step brighter', [['400', '300'], ['300', '200'], ['200', '100']].every(([from, to]) =>
  dark.includes(`[data-theme='dark'] .dark\\:text-primary-${from}`) && new RegExp(`dark\\\\:text-primary-${from}[^{]*\\{\\s*color:\\s*rgb\\(var\\(--primary-${to}\\)\\)`).test(dark)))
check('red, green, blue and white keep their colour', ['text-red', 'text-green', 'text-primary', 'text-white'].every((c) => css.includes(`[class*='${c}'] *`)))

console.log('\nLodgement sheet')
const audit = read('screens', 'dashboard', 'reports', 'audit-report', 'page.js')
check('Total Lodged follows Total Transfer', /Total Transfer<\/th>\s*<th[^>]*>Total Lodged<\/th>/.test(audit))
check('a row\'s Total Lodged is POS + Transfer', audit.includes('fmt(tPOS + tTransfer)') && audit.includes('fmt(gPOS + gTransfer)'))
check('the title spans the extra column', audit.includes('4 + displayBanks.length + 7'))

console.log('\nPlain exports')
const plainAudit = read('lib', 'exportAuditGenericExcel.js')
check('cash reconciliation is not labelled with the code\'s names', !plainAudit.includes('Object.entries(cash)'))
check('cash reconciliation reads as the screen does', ['Expected Sales from Products for the Period', 'Total Lodgement for the Period', 'Total POS for the Period', 'Total Transfer for the Period', 'Overage/Shortage'].every((l) => plainAudit.includes(l)))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
