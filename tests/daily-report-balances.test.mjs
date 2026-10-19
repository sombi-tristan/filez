/**
 * Pins the daily sales report's Balances (lib/buildDailyReport.js): each credit customer's
 * balance at the end of the day, as the Account Ledger works it out (opening balance + credit
 * sales - payments up to and including the day). Above zero the customer owes the station, below
 * zero the station owes the customer; at zero, and the default accounts, are left out.
 *
 * Run: node tests/daily-report-balances.test.mjs
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

const nozzles = [{ id: 'p1', fuel_type: 'PMS', pump_number: 1, initial_reading: 0 }]
const day = (date, closing) => ({ id: `s-${date}`, entryDate: date, createdAt: `${date}T08:00:00Z`, prices: { PMS: 1000 }, closeOfBusiness: true, nozzleReadings: [{ pump_id: 'p1', closing_meter: closing }], tankReadings: [] })
const sales = [day('2026-10-01', 100), day('2026-10-02', 200)]

const customers = [
  { id: 'a', name: 'Ade Transport', phone: '080', opening_balance: 10000 },
  { id: 'b', name: 'Bisi Haulage', phone: '081', opening_balance: 0 },
  { id: 'c', name: 'Cleared Ltd', phone: '082', opening_balance: 5000 },
  { id: 'd', name: 'Police', phone: 'DEFAULT', opening_balance: 9000 },
]
const pay = (id, customerId, entryDate, salesAmount, amountPaid) => ({ id, customerId, entryDate, salesAmount, amountPaid })
const customerPayments = [
  pay('1', 'a', '2026-10-01', 20000, 0),
  pay('2', 'b', '2026-10-01', 0, 15000), // paid ahead: the station owes Bisi
  pay('3', 'c', '2026-10-01', 0, 5000), // cleared to zero
  pay('4', 'a', '2026-10-02', 0, 25000), // the next day: Ade is down to 5,000
]

const report = buildDailyReport({ sales, receipts: [], lodgements: [], nozzles, tanks: [], banks: [], customers, customerPayments, startDate: '2026-10-01', endDate: '2026-10-02' })
const [d1, d2] = report.dateReports
const row = (d, id) => d.balances.rows.find((r) => r.customerId === id)

console.log('End of the first day')
check('a customer who owes: opening + credit sales', row(d1, 'a')?.owesStation === 30000 && row(d1, 'a')?.stationOwes === 0)
check('a customer who paid ahead: the station owes', row(d1, 'b')?.stationOwes === 15000 && row(d1, 'b')?.owesStation === 0)
check('a balance at zero is left out', !row(d1, 'c'))
check('default accounts are left out', !row(d1, 'd'))
check('totals add up', d1.balances.totalOwesStation === 30000 && d1.balances.totalStationOwes === 15000)
check('a later payment is not counted yet', row(d1, 'a')?.owesStation === 30000)

console.log('\nEnd of the second day')
check('the day\'s payment is counted', row(d2, 'a')?.owesStation === 5000)
check('earlier days still count', row(d2, 'b')?.stationOwes === 15000)

console.log('\nWithout customers')
const bare = buildDailyReport({ sales, receipts: [], lodgements: [], nozzles, tanks: [], banks: [], startDate: '2026-10-01', endDate: '2026-10-01' })
check('no rows, no error', bare.dateReports[0].balances.rows.length === 0)

console.log('\nOn screen')
const page = readFileSync(new URL('../screens/dashboard/reports/daily-sales-report/page.js', import.meta.url), 'utf8')
check('Balances is its own table, after the divider and before the totals table', page.indexOf('<hr ') < page.indexOf('title="Balances"') && page.indexOf('title="Balances"') < page.indexOf('{/* The totals table */}') && page.indexOf('title="Balances"') < page.indexOf("section('Consumption'"))
check('the page passes customers and their payments', page.includes('customerPayments: livePayments'))

console.log('\nIn Excel')
const excel = readFileSync(new URL('../lib/exportDailyReportExcel.js', import.meta.url), 'utf8')
check('the Balances block comes first, before Consumption, as on screen', excel.indexOf("'Balances'") > 0 && excel.indexOf("'Balances'") < excel.indexOf("renderSection('Consumption'"))
check('its columns are Owes station and Station owes', excel.includes("'Owes station'") && excel.includes("'Station owes'"))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
