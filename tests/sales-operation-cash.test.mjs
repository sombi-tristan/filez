/**
 * Pins the Sales Operation report's cash (lib/buildSalesOperationReport.js). Previous Day Cash @
 * Hand is yesterday's Cash @ Hand as it stood, and today's deposit is taken from it: Expected Cash
 * @ Hand is that, less the day's bank deposits, plus the day's sales, less every POS and every
 * transfer. The next day starts from that figure, so it only grows on a day with no deposit.
 * It was leaving transfers in (on the Lucky Way
 * backup, 1 Oct read 1,607,672: exactly the day's transfers) and so carried that error into every
 * day after, and it counted only the deposits and POS the form has rows for.
 *
 * Run: node tests/sales-operation-cash.test.mjs
 */
import { register } from 'node:module'
register('./helpers/app-loader.mjs', import.meta.url)
const { buildSalesOperationReport } = await import('../lib/buildSalesOperationReport.js')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

// One PMS pump selling 100 litres a day at 1,000: 100,000 of sales a day.
const nozzles = [{ id: 'p1', fuel_type: 'PMS', pump_number: 1, initial_reading: 0 }]
const day = (date, closing) => ({ id: `s-${date}`, entryDate: date, createdAt: `${date}T08:00:00Z`, prices: { PMS: 1000 }, closeOfBusiness: true, nozzleReadings: [{ pump_id: 'p1', closing_meter: closing }], tankReadings: [] })
const sales = [day('2026-10-01', 100), day('2026-10-02', 200)]

// Seven POS terminals and five deposit banks, more than the form has rows for (6 and 4), and a transfer bank.
const banks = [
  ...Array.from({ length: 7 }, (_, i) => ({ id: `pos${i}`, bank_name: `POS ${i}`, lodgement_type: 'pos' })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `dep${i}`, bank_name: `Deposit ${i}`, lodgement_type: 'bank_deposit' })),
  { id: 'tr', bank_name: 'Transfer', lodgement_type: 'transfer' },
]
const lodge = (date, bankId, amount) => ({ id: `${date}-${bankId}`, entryDate: date, salesDate: date, bankId, amount, lodgementType: banks.find((b) => b.id === bankId).lodgement_type })
const lodgements = [
  // Day 1: 7 x 5,000 POS, a 40,000 transfer and 5 x 4,000 banked leave 5,000 cash in hand,
  // which the next day starts from.
  ...banks.filter((b) => b.lodgement_type === 'pos').map((b) => lodge('2026-10-01', b.id, 5000)),
  ...banks.filter((b) => b.lodgement_type === 'bank_deposit').map((b) => lodge('2026-10-01', b.id, 4000)),
  lodge('2026-10-01', 'tr', 40000),
  // Day 2: all 100,000 by transfer, so the drawer still holds day 1's 5,000.
  lodge('2026-10-02', 'tr', 100000),
]

const report = buildSalesOperationReport({ sales, receipts: [], lodgements, lubeSales: [], lubeProducts: [], nozzles, tanks: [], banks, startDate: '2026-10-01', endDate: '2026-10-02' })
const [d1, d2] = report.sheets

console.log('One day')
check('sales are the day\'s fuel', d1.cash.totalExpectedSales === 100000)
check('every POS counts, not only the six the form shows', d1.cash.totalPOS === 35000)
check('every deposit counts, not only the four the form shows', d1.cash.totalBankDeposit === 20000)
check('transfers count', d1.cash.totalTransfer === 40000)
check('expected cash at hand is previous - deposits + sales - POS & transfer: 5,000', d1.cash.expectedCashAtHand === 5000)

console.log('\nThe next day')
check('previous day cash is yesterday\'s cash at hand, not a running error', d2.cash.prevDayCash === d1.cash.actualCashAtHand && d2.cash.prevDayCash === 5000)
check('all by transfer: the cash in hand is just that 5,000', d2.cash.expectedCashAtHand === 5000)

// Day 3: 100,000 cash sales and no deposit: the cash in hand grows by the day's sales.
const sales3 = [...sales, day('2026-10-03', 300)]
const r3 = buildSalesOperationReport({ sales: sales3, receipts: [], lodgements, lubeSales: [], lubeProducts: [], nozzles, tanks: [], banks, startDate: '2026-10-01', endDate: '2026-10-03' })
const d3 = r3.sheets[2]
console.log('\nA day with no deposit')
check('starts from yesterday\'s 5,000', d3.cash.prevDayCash === 5000)
check('only then the cash at hand grows: 105,000', d3.cash.expectedCashAtHand === 105000)

// Rainoil's form has no column for transfers: they go in with POS, as "Total POS & Transfer",
// and Expected Cash is Sales + Previous - Deposits - POS & Transfer.
console.log('\nThe cash row adds up, on screen and in Excel')
const { readFileSync } = await import('node:fs')
const page = readFileSync(new URL('../screens/dashboard/reports/sales-operation/page.js', import.meta.url), 'utf8')
const excel = readFileSync(new URL('../lib/exportSalesOperationExcel.js', import.meta.url), 'utf8')
check('on screen: Total POS & Transfer, both counted', (page.includes('>Total POS &amp; Transfer<') || page.includes("'Total POS & Transfer'")) && page.includes('fmt(cash.totalPOS + cash.totalTransfer)'))
check('in Excel: the heading says so', excel.includes("'Total POS & Transfer'"))
check('in Excel: POS & Transfer is every POS and transfer, not a sum of the six POS cells', excel.includes('setNum(ws, 25, 5, cash.totalPOS + cash.totalTransfer') && !excel.includes('SUM(F21:K21)'))
check('in Excel: deposits are every deposit, not a sum of the four deposit cells', excel.includes('setNum(ws, 25, 4, cash.totalBankDeposit') && !excel.includes('B21+C21+D21+E21'))
check('in Excel: Expected Cash is Sales + Previous - Deposits - POS & Transfer', excel.includes('`B25+C25-D25-E25`') && !excel.includes('`B25+C25-E25`'))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
