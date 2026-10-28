/**
 * Pins the Consumption and Fuel Stock reports, which replaced Sales Operation on the phone
 * (screens/dashboard/reports/consumption, screens/dashboard/reports/fuel-stock):
 *
 *   Both are reports the website and Android app keep, gated by the audit report's existing
 *   keys so the live server needs nothing new, and both show one day at a time with Prev / Next
 *   (components/reports/DayNav.js) as the Summary report does.
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

const routes = read('screens/routes.js')
for (const [slug, key, label] of [['consumption', 'report-audit-consumption', 'Consumption'], ['fuel-stock', 'report-audit-stock-summary', 'Fuel Stock']]) {
  console.log(`\n${label}`)
  const link = nav.REPORT_LINKS('x').find((l) => l.pageKey === key)
  check('one of the reports the website keeps', link && link.href.startsWith(`/dashboard/reports/${slug}?`))
  check('a grantable permission key', nav.ALL_PAGE_KEYS.includes(key))
  const route = routes.split('\n').find((l) => l.includes(`path: '/dashboard/reports/${slug}'`)) || ''
  check('a report route, not desktop only', route.includes('report: true') && !route.includes('desktopOnly'))
  const page = read(`screens/dashboard/reports/${slug}/page.js`)
  check('gated by its key', page.includes(`pageKey="${key}"`))
  check('day by day with Prev / Next', page.includes('<DayNav') && page.includes('pickDay('))
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
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
