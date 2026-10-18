/**
 * Pins the daily sales report's Cons column: in this report pour back is consumption, so each
 * nozzle's Cons is its consumption plus its pour back, as the fuel's subtotal already was
 * (lib/buildDailyReport.js; the screen and its Excel export show the row's `consumed`).
 *
 * Run: node tests/daily-report-cons.test.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./helpers/app-loader.mjs', import.meta.url)
const { buildDailyReport } = await import('../lib/buildDailyReport.js')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const nozzles = [
  { id: 'p1', fuel_type: 'PMS', pump_number: 1, initial_reading: 1000 },
  { id: 'p2', fuel_type: 'PMS', pump_number: 2, initial_reading: 5000 },
]
const sales = [{
  id: 's1', entryDate: '2026-10-10', createdAt: '2026-10-10T08:00:00Z', prices: { PMS: 900 }, closeOfBusiness: true,
  nozzleReadings: [
    { pump_id: 'p1', closing_meter: 1100, consumption: 10, pour_back: 5 },
    { pump_id: 'p2', closing_meter: 5050, consumption: 0, pour_back: 7 },
  ],
  tankReadings: [],
}]
const report = buildDailyReport({ sales, receipts: [], lodgements: [], nozzles, tanks: [], banks: [], startDate: '2026-10-10', endDate: '2026-10-10' })
const day = (report.dateReports || []).find((d) => d.date === '2026-10-10') || report.dateReports?.[0]
const group = day?.entryGroups?.[0]?.nozzleRows?.find((g) => g.fuelType === 'PMS')
const row = (id) => group?.rows.find((r) => r.pumpId === id)

console.log('A nozzle\'s Cons')
check('is its consumption plus its pour back', row('p1')?.consumed === 15)
check('counts pour back with no consumption', row('p2')?.consumed === 7)
check('the fuel\'s subtotal Cons is its consumption plus its pour back too', group?.totals?.consumed === 22)
check('the nozzles add up to it', row('p1')?.consumed + row('p2')?.consumed === group?.totals?.consumed)
check('Actual is unchanged: dispensed less both', group?.totals?.actual === 150 - 22)
check('the day\'s own totals, shared with other reports, still keep pour back apart', day?.dayFuelTotals?.PMS ? day.dayFuelTotals.PMS.consumed === 10 && day.dayFuelTotals.PMS.pourBack === 12 : true)

console.log('\nShown under Cons')
const page = readFileSync(new URL('../screens/dashboard/reports/daily-sales-report/page.js', import.meta.url), 'utf8')
const excel = readFileSync(new URL('../lib/exportDailyReportExcel.js', import.meta.url), 'utf8')
check('on screen', page.includes('fmt(r.consumed)') && !page.includes('fmt(r.consumption)'))
check('in the Excel export', excel.includes('fmt(r.consumed)') && !excel.includes('fmt(r.consumption)'))
check('and the export\'s grand total counts pour back too', /totCons\s*=\s*fuelTypes\.reduce\(\(s, ft\) => s \+ dr\.dayFuelTotals\[ft\]\.consumed \+ \(dr\.dayFuelTotals\[ft\]\.pourBack \|\| 0\), 0\)/.test(excel))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
