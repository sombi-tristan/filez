/**
 * Pins three asks on the reports:
 *
 *   Sales Operation (the Rainoil workbook): the budget rows' Variance is calculated, actual overage minus expected
 *   overage from the stock (the stock reconciliation rows above it), not sales minus a budget
 *   fixed in the code. The lube section lists only products with something in them.
 *   Product Received: no Dip Calculator button at the top (each receipt keeps its own icon).
 *
 * Run: node tests/sales-operation-variance.test.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./helpers/app-loader.mjs', import.meta.url)
const { buildSalesOperationReport } = await import('../lib/buildSalesOperationReport.js')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const page = read('screens/dashboard/reports/sales-operation/page.js')
const excel = read('lib/exportSalesOperationExcel.js')

console.log('Budget variance')
// The screen no longer shows a budget (the audit-style screen drops it); the Rainoil workbook does.
check('on screen: no budget rows any more', !/budgetRow|Budget/.test(page))
check('in Excel: the stock row\'s Variance cell, not sales less a budget',excel.includes('setFormula(ws, row, 4, `D${RECON_ROWS[ft]}`') && !excel.includes('`J${fuelRow}-B${row}`'))

console.log('\nLube: only products with something in them')
{
  const nozzles = [{ id: 'p1', fuel_type: 'PMS', pump_number: 1, initial_reading: 0 }]
  const sales = [{ id: 's1', entryDate: '2026-10-01', createdAt: '2026-10-01T08:00:00Z', prices: { PMS: 1000 }, closeOfBusiness: true, nozzleReadings: [{ pump_id: 'p1', closing_meter: 10 }], tankReadings: [] }]
  const lubeProducts = [
    { id: 'sold', product_name: 'Sold today', opening_stock: 10, unit_price: 500 },
    { id: 'stocked', product_name: 'In stock, none sold', opening_stock: 4, unit_price: 500 },
    { id: 'empty', product_name: 'Nothing at all', opening_stock: 0, unit_price: 500 },
    { id: 'received', product_name: 'Received today', opening_stock: 0, unit_price: 500 },
  ]
  const lubeSales = [
    { id: 'l1', entryDate: '2026-10-01', productId: 'sold', unitSold: 3, unitReceived: 0, price: 500 },
    { id: 'l2', entryDate: '2026-10-01', productId: 'received', unitSold: 0, unitReceived: 6, price: 500 },
  ]
  const report = buildSalesOperationReport({ sales, receipts: [], lodgements: [], lubeSales, lubeProducts, nozzles, tanks: [], banks: [], startDate: '2026-10-01', endDate: '2026-10-01' })
  const names = report.sheets[0].lube.map((l) => l.productName)
  check('a product with nothing in it is left out', !names.includes('Nothing at all'))
  check('sold, stocked and received ones stay', ['Sold today', 'In stock, none sold', 'Received today'].every((n) => names.includes(n)))
}

console.log('\nProduct Received')
const received = read('screens/dashboard/reports/product-received/page.js')
check('no Dip Calculator button at the top', !/>\s*Dip Calculator\s*</.test(received) && !received.includes('href={`/dashboard/reports/dip-calculator?org_id=${orgId}`}'))
check('each receipt keeps its own calculator icon', received.includes('title="Dip Calculator"'))

console.log('\nSales Operation export: header rows tall enough for their wrapped text')
for (const r of [4, 15, 20]) {
  check(`row ${r}`, new RegExp(`ws\\.getRow\\(${r}\\)\\.height = HEADER_ROW_HEIGHT`).test(excel))
}
check('two lines of header text fit', /const HEADER_ROW_HEIGHT = (3[0-9]|[4-9][0-9])\b/.test(excel))

console.log('\nSales Operation export: no thick border round the sheet')
check('the outer edge is a thin line, like the grid', !excel.includes("style: 'thick'") && !/\bthick\(/.test(excel) && /const edge\s*=\s*\(argb = BLACK\) => \(\{ style: 'thin'/.test(excel))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
