/**
 * Pins the Sales Operation report's place and look (screens/dashboard/reports/sales-operation):
 *
 *   Every station has it again, in the app's report styling: each day one page, its parts
 *   stacked in the form's order (Sales, Stock, Overage, Lodgements, Cash, Lube) as plain report
 *   tables, no section tabs (the owner asked for the styling, not the audit report's tabs), the
 *   day chosen in the tabs below, and none of the Rainoil form's budget or competitor prices. A Rainoil station exports its replica workbook
 *   (lib/exportSalesOperationExcel.js); every other station a plain one
 *   (lib/exportSalesOperationGenericExcel.js). At most 32 days, like the audit report.
 *
 * Run: node tests/sales-operation.test.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./helpers/app-loader.mjs', import.meta.url)
const nav = await import('../lib/stationNav.js')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const KEY = 'report-sales-operation'
const keysIn = (sections) => sections.flatMap((s) => (s.links || s.items || []).map((l) => l.pageKey))

// Desktop build: Consumption & Fuel Stock replaced it, as on the phone. The screen stays in the
// tree, reachable from nowhere.
console.log('Replaced by Consumption & Fuel Stock')
check('not in REPORT_LINKS', !nav.REPORT_LINKS('x').some((l) => l.pageKey === KEY))
check('not in any station\'s sidebar', !keysIn(nav.buildStationNav('x', { isOwner: true, groupName: 'Other Group' })).includes(KEY) && !keysIn(nav.buildStationNav('x', { isOwner: true })).includes(KEY))
check('not on the home or in staff permissions', !keysIn(nav.REPORT_SECTIONS('x', 'Other Group')).includes(KEY) && !nav.reportPermissionOptions('Other Group').some((o) => o.key === KEY))
check('Consumption & Fuel Stock in the sidebar and on the home', keysIn(nav.buildStationNav('x', { isOwner: true })).includes('report-audit-consumption') && keysIn(nav.REPORT_SECTIONS('x', 'Other Group')).includes('report-audit-consumption'))
check('no route to it', !read('screens/routes.js').includes('/dashboard/reports/sales-operation') && read('screens/routes.js').includes('/dashboard/reports/consumption-fuel-stock'))

const page = read('screens/dashboard/reports/sales-operation/page.js')
console.log('\nAudit-style screen')
check('no longer turns other stations away', !page.includes('This report is for Rainoil stations.'))
check('no section tabs', !page.includes('const SECTIONS') && !page.includes('role="tablist"') && !page.includes('setSection'))
{
  const order = ['<SalesSection sheet={activeSheet} />', '<StockSection sheet={activeSheet} />', '<CashSection sheet={activeSheet} />', '<LubeSection sheet={activeSheet} />'].map((s) => page.indexOf(s))
  check('the whole day on one page, its parts stacked in the form\'s order', order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1])))
}
check('plain report tables in the report frame, not the replica sheet', page.includes('${REPORT_CARD}') && page.includes('REPORT_HEAD') && !page.includes('SalesOperationGrid') && !page.includes('sheet-light'))
check('no budget, achievement or competitor prices on screen', !/Budget|Achievement|Competitor/.test(page))
check('overage and truck shortage come from the builder', page.includes('sheet.overage') && page.includes('s.truckShortage'))
check('the light sheet\'s styles are gone', !read('app/globals.css').includes('.sheet-light'))

console.log('\nExport')
check('Rainoil stations their replica, others a plain workbook', /isRainoilGroup\(stationGroup\)\s*\?\s*exportSalesOperationExcel\s*:\s*exportSalesOperationGenericExcel/.test(page))

console.log('\nAt most 32 days, like the audit report')
check('Load greys out over 32 days', /disabled=\{!startDate \|\| !endDate \|\| startDate > endDate \|\| rangeDays\(startDate, endDate\) > MAX_DAYS\}/.test(page) && page.includes('const MAX_DAYS = 32'))
check('a line under the dates says so', page.includes('Date range cannot exceed {MAX_DAYS} days ({rangeDays(startDate, endDate)} days selected).'))
check('and Load itself refuses a longer range', /const handleGenerate = \(\) => \{[\s\S]{0,200}if \(rangeDays\(s, e\) > MAX_DAYS\) return/.test(page))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
