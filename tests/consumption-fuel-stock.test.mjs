/**
 * Pins the Consumption & Fuel Stock report, which replaced Sales Operation on the phone
 * (screens/dashboard/reports/consumption-fuel-stock), and the day-by-day frame it shares with
 * the Summary report:
 *
 *   One report the website and Android app keep, gated by the audit report's existing
 *   report-audit-consumption key so the live server needs nothing new. The day's consumption
 *   (one table: accounts, then each fuel's total) and pour back, then its closing stock in one
 *   row: DATE, each PMS tank, TOTAL PMS, each AGO tank, ... (a fuel with one tank has no number
 *   and no total). The date sits big and bold at the top, Prev / Next at the bottom
 *   (components/reports/DayNav.js). Summary shows each fuel's price.
 *
 * Run: node tests/consumption-fuel-stock.test.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./helpers/app-loader.mjs', import.meta.url)
const nav = await import('../lib/stationNav.js')
const { buildDailyReport } = await import('../lib/buildDailyReport.js')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const KEY = 'report-audit-consumption'
const routes = read('screens/routes.js')
console.log('One report')
const link = nav.REPORT_LINKS('x').find((l) => l.pageKey === KEY)
check('one of the reports the website keeps', link && link.href.startsWith('/dashboard/reports/consumption-fuel-stock?') && link.label === 'Consumption & Fuel Stock')
check('no separate Consumption or Fuel Stock report', !nav.REPORT_LINKS('x').some((l) => /\/reports\/(consumption|fuel-stock)\?/.test(l.href)) && !routes.includes("'/dashboard/reports/fuel-stock'") && !routes.includes("'/dashboard/reports/consumption'"))
check('a grantable permission key', nav.ALL_PAGE_KEYS.includes(KEY))
const route = routes.split('\n').find((l) => l.includes("path: '/dashboard/reports/consumption-fuel-stock'")) || ''
check('a report route, not desktop only', route.includes('report: true') && !route.includes('desktopOnly'))

const page = read('screens/dashboard/reports/consumption-fuel-stock/page.js')
console.log('\nThe page')
check('gated by its key', page.includes(`pageKey="${KEY}"`))
check('consumption, then tank stock', page.indexOf("entryTable('Consumption'") > 0 && page.indexOf("entryTable('Consumption'") < page.indexOf('stockCols.map'))
check('one consumption table: no separate per-fuel table, each fuel totalled inside it', !page.includes('>Pour Back</th>') && page.includes('Total {ft}'))
check('stock is one row: DATE, then the tanks', page.includes('>DATE</th>') && page.includes('value: t.closing'))
check('a fuel with one tank: no number, no total', page.includes('label: f.tanks.length > 1 ? t.label : ft') && /if \(f\.tanks\.length > 1\) cols\.push\(\{[^}]*TOTAL \$\{ft\}[^}]*totalClosing/.test(page))

console.log('\nThe date big and bold at the top, Prev / Next at the bottom')
const summary = read('screens/dashboard/reports/summary/page.js')
for (const [name, src] of [['Consumption & Fuel Stock', page], ['Summary', summary]]) {
  check(`${name}: the date above the report card`, src.includes('<DayTitle') && src.indexOf('<DayTitle') < src.indexOf('${REPORT_CARD}'))
  check(`${name}: Prev / Next after it`, src.includes('<DayNav') && src.indexOf('<DayNav') > src.indexOf('${REPORT_CARD}'))
}
const dayNav = read('components/reports/DayNav.js')
check('the date in bigger, bold text', /text-lg font-bold[^>]*>\s*\{fmtDate\(date\)\}/.test(dayNav))
check('Summary shows each fuel\'s price', summary.includes('>Price</th>') && summary.includes('dayFuelTotals[ft]?.price'))

console.log('\nThe Android app')
check('Lube Report is one of the reports the app keeps', nav.REPORT_LINKS('x').some((l) => l.pageKey === 'report-lube') && !(routes.split('\n').find((l) => l.includes("path: '/dashboard/reports/lube-report'")) || '').includes('desktopOnly'))
check('no PWA install prompt inside the app', read('components/InstallPWABanner.js').includes('window.Capacitor?.isNativePlatform?.()'))
{
  const lubeReport = read('screens/dashboard/reports/lube-report/page.js')
  check('the Lube Report\'s Stock Summary can hide products with no closing stock', lubeReport.includes("activeTab === 'summary' && <Toggle checked={hideEmpty}") && lubeReport.includes('.filter((r) => !hideEmpty || (r.actualClosing ?? r.expectedClosing) !== 0)'))
}

console.log('\nThe figures come from buildDailyReport')
{
  const nozzles = [{ id: 'n1', fuel_type: 'PMS', pump_number: 1, tank_id: 't1', initial_reading: 0 }]
  const tanks = [{ id: 't1', fuel_type: 'PMS', tank_number: 1, opening_stock: 10000 }]
  const sales = [{
    id: 's1', entryDate: '2026-10-01', closeOfBusiness: true, prices: { PMS: 900 },
    nozzleReadings: [{ pump_id: 'n1', fuel_type: 'PMS', closing_meter: 1000, consumption: 20, consumption_customer_id: 'c1', pour_back: 5, pour_back_customer_id: 'c2' }],
    tankReadings: [{ tank_id: 't1', closing_stock: 9000 }],
  }]
  const r = buildDailyReport({ sales, receipts: [], lodgements: [], nozzles, tanks, banks: [], startDate: '2026-10-01', endDate: '2026-10-02' })
  const d1 = r.dateReports[0]
  check('a report per day of the range', r.dateReports.length === 2)
  check('consumption and pour back by account, with price', d1.consumption.entries.some((e) => !e.isPourBack && e.customerId === 'c1' && e.quantity === 20 && e.price === 900) && d1.consumption.entries.some((e) => e.isPourBack && e.customerId === 'c2' && e.quantity === 5))
  const pms = d1.tanksByFuel.PMS
  check('tank opening and closing', pms.tanks[0].opening === 10000 && pms.tanks[0].closing === 9000)
  check('the next day opens on the day before\'s close', r.dateReports[1].tanksByFuel.PMS.tanks[0].opening === 9000)
  check('the day\'s price per fuel, for the Summary', d1.dayFuelTotals.PMS.price === 900)
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
