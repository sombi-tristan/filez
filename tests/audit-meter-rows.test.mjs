/**
 * Integration test for buildFuelMeterRows — extracts the REAL function
 * from lib/buildAuditReport.js and tests it with REAL data from
 * excel/test-amount.xlsx (all 8 PMS pumps, 15 days).
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcPath = resolve(__dirname, '..', 'lib', 'buildAuditReport.js')
const xlsxPath = resolve(__dirname, '..', 'excel', 'test-amount.xlsx')

// ═══════════════════════════════════════════════════
// Extract the REAL buildFuelMeterRows from source
// ═══════════════════════════════════════════════════
const src = readFileSync(srcPath, 'utf8')
const fnStart = src.indexOf('function buildFuelMeterRows(')
if (fnStart === -1) throw new Error('buildFuelMeterRows not found in source')

function extractFunction(code, startIdx) {
  let depth = 0, started = false
  for (let i = startIdx; i < code.length; i++) {
    if (code[i] === '{') { depth++; started = true }
    if (code[i] === '}') depth--
    if (started && depth === 0) return code.slice(startIdx, i + 1)
  }
  throw new Error('Could not extract function')
}
const buildFuelMeterRows = new Function('return ' + extractFunction(src, fnStart))()

// ═══════════════════════════════════════════════════
// Extract REAL data from Excel
// ═══════════════════════════════════════════════════
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(xlsxPath)

// A sheet as rows of cell values, both from 0 (row 1 is data[0], column A is row[0]); a formula
// cell gives its saved result, and is empty when the file saved none.
function sheetRows(sheet) {
  const data = []
  sheet.eachRow({ includeEmpty: true }, (row, r) => {
    const values = []
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const v = cell.value
      values[c - 1] = v && typeof v === 'object' && !(v instanceof Date) ? v.result : v
    })
    data[r - 1] = values
  })
  return data
}

// PMS has 8 pumps: rows 2-9 in each entry block
// Entry 1: rows 2-9 (pumps), row 10 (summary with price)
// Entry 2: rows 17-24 (pumps), row 25 (summary with price)
// Entry 3: rows 33-40 (pumps), row 41 (summary with price)
const PMS_PUMP_COUNT = 8
const pumpIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
const ftNozzles = pumpIds.map((id, i) => ({ id, pump_number: i + 1 }))

function readEntry(data, pumpStartRow, summaryRow) {
  const closings = {}
  let hasData = false
  for (let i = 0; i < PMS_PUMP_COUNT; i++) {
    const row = data[pumpStartRow + i]
    if (!row) continue
    const closing = row[2] // Column C = closing
    if (closing != null && closing !== '') {
      closings[pumpIds[i]] = Number(closing)
      hasData = true
    }
  }
  const summRow = data[summaryRow]
  const dispensed = summRow ? Number(summRow[3] || 0) : 0
  const price = summRow ? Number(summRow[6] || 0) : 0
  const consumed = summRow ? Number(summRow[4] || 0) : 0
  const actual = summRow ? Number(summRow[5] || 0) : 0
  const amount = summRow ? Number(summRow[7] || 0) : 0
  return { closings, price, dispensed, consumed, actual, amount, hasData }
}

// Get initial openings from Day 1 Entry 1 opening column
const day1 = sheetRows(wb.getWorksheet('1'))
const openings = {}
for (let i = 0; i < PMS_PUMP_COUNT; i++) {
  const row = day1[2 + i]
  openings[pumpIds[i]] = Number(row[1]) // Column B = opening
}

// Extract all entries across 15 days
const allEntries = []
let excelTotalAmount = 0
let excelTotalDispensed = 0
let excelTotalConsumed = 0
let excelConsumptionAmount = 0

for (let day = 1; day <= 15; day++) {
  const sheet = wb.getWorksheet(String(day))
  if (!sheet) continue
  const data = sheetRows(sheet)

  // Entry 1: pumps at rows 2-9, summary at row 10
  const e1 = readEntry(data, 2, 10)
  if (e1.hasData && (e1.dispensed > 0 || e1.price > 0)) {
    allEntries.push({ price: e1.price, closings: e1.closings, day, entry: 1 })
    excelTotalAmount += e1.amount
    excelTotalDispensed += e1.dispensed
    excelTotalConsumed += e1.consumed
    if (e1.consumed > 0) excelConsumptionAmount += e1.consumed * e1.price
  }

  // Entry 2: pumps at rows 17-24, summary at row 25
  const e2 = readEntry(data, 17, 25)
  if (e2.hasData && (e2.dispensed > 0 || e2.price > 0)) {
    allEntries.push({ price: e2.price, closings: e2.closings, day, entry: 2 })
    excelTotalAmount += e2.amount
    excelTotalDispensed += e2.dispensed
    excelTotalConsumed += e2.consumed
    if (e2.consumed > 0) excelConsumptionAmount += e2.consumed * e2.price
  }

  // Entry 3: pumps at rows 33-40, summary at row 41 (only some days)
  if (data.length > 33) {
    const e3 = readEntry(data, 33, 41)
    if (e3.hasData && (e3.dispensed > 0 || e3.price > 0)) {
      allEntries.push({ price: e3.price, closings: e3.closings, day, entry: 3 })
      excelTotalAmount += e3.amount
      excelTotalDispensed += e3.dispensed
      excelTotalConsumed += e3.consumed
      if (e3.consumed > 0) excelConsumptionAmount += e3.consumed * e3.price
    }
  }
}

// Determine initPrice (price before range — use first entry's price if no prior)
const initPrice = allEntries[0]?.price || 0

// Fill missing prices (carry forward) — same as the real code does
let lastKnown = initPrice
for (const e of allEntries) {
  if (e.price) lastKnown = e.price
  else e.price = lastKnown
}

// ═══════════════════════════════════════════════════
// Run buildFuelMeterRows with REAL data
// ═══════════════════════════════════════════════════
const result = buildFuelMeterRows('PMS', ftNozzles, pumpIds, allEntries, openings, initPrice)
const rows = result.rows

// ═══════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════
let passed = 0, failed = 0
function assert(cond, msg) {
  if (cond) passed++
  else { failed++; console.error('FAIL:', msg) }
}

console.log('=== Excel Data Summary ===')
console.log('Entries extracted:', allEntries.length)
console.log('Excel total dispensed (PMS):', excelTotalDispensed)
console.log('Excel total consumed (PMS):', excelTotalConsumed)
console.log('Excel total sales amount (PMS, actual*price):', excelTotalAmount)
console.log('Excel consumption amount:', excelConsumptionAmount)
console.log('Initial openings:', openings)
console.log()

console.log('=== buildFuelMeterRows Output ===')
const totalDispensed = rows.reduce((s, r) => s + r.dispensed, 0)
const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
console.log('Rows:', rows.length)
console.log('Price sequence:', rows.map(r => r.price).join(' -> '))
console.log('Total dispensed:', totalDispensed)
console.log('Total amount (dispensed*price):', totalAmount)
console.log('Expected sales (amount - consumption):', totalAmount - excelConsumptionAmount)
console.log()

for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  console.log(`Row ${i + 1}: price=${r.price}, dispensed=${r.dispensed}, amount=${r.amount}`)
}
console.log()

// Test 1: Expected price sequence
const expectedPrices = [850, 950, 1025, 1050, 1082, 1240, 1300, 1200, 1300]
assert(rows.length === expectedPrices.length, `Expected ${expectedPrices.length} rows, got ${rows.length}`)
assert(JSON.stringify(rows.map(r => r.price)) === JSON.stringify(expectedPrices),
  `Price sequence mismatch: got ${rows.map(r => r.price)}`)

// Test 2: Chain integrity
for (let i = 1; i < rows.length; i++) {
  for (let p = 0; p < pumpIds.length; p++) {
    assert(rows[i].pumps[p].opening === rows[i - 1].pumps[p].closing,
      `Chain break row ${i} pump ${pumpIds[p]}: open=${rows[i].pumps[p].opening} != prevClose=${rows[i - 1].pumps[p].closing}`)
  }
}

// Test 3: First row opening = initial openings
for (let p = 0; p < pumpIds.length; p++) {
  assert(rows[0].pumps[p].opening === openings[pumpIds[p]],
    `First row pump ${pumpIds[p]}: open=${rows[0].pumps[p].opening} != initial=${openings[pumpIds[p]]}`)
}

// Test 4: Total dispensed matches Excel
assert(totalDispensed === excelTotalDispensed,
  `Total dispensed ${totalDispensed} != Excel ${excelTotalDispensed}`)

// Test 5: expectedSalesAmt = totalAmount - consumptionAmount = Excel's Sales Amount
const expectedSalesAmt = totalAmount - excelConsumptionAmount
assert(expectedSalesAmt === excelTotalAmount,
  `Expected sales ${expectedSalesAmt} != Excel sales amount ${excelTotalAmount}`)

// Test 6: The key figure — expected sales should be 69,068,137
// (The Excel SALES sheet shows 69,958,989 but that has a formula error on Day 7:
//  SALES says 5,731,364 but day entries sum to 4,840,512, diff = 890,852)
assert(expectedSalesAmt === 69068137,
  `Expected sales ${expectedSalesAmt} != 69,068,137`)

// Test 7: Each row's dispensed = sum of pumps
for (let i = 0; i < rows.length; i++) {
  const pumpSum = rows[i].pumps.reduce((s, p) => s + p.dispensed, 0)
  assert(Math.abs(rows[i].dispensed - pumpSum) < 0.01, `Row ${i} dispensed != pump sum`)
}

// Test 8: Each row's amount = dispensed * price
for (let i = 0; i < rows.length; i++) {
  assert(Math.abs(rows[i].amount - rows[i].dispensed * rows[i].price) < 0.01,
    `Row ${i} amount ${rows[i].amount} != ${rows[i].dispensed * rows[i].price}`)
}

// Test 9: No zero-dispensed rows
assert(rows.every(r => r.dispensed > 0), 'No row should have zero dispensed')

// Test 10: COB entry (Day 7 E3) properly handled — only 1 row at 1050
assert(rows.filter(r => r.price === 1050).length === 1, 'Exactly 1 row at price 1050')

console.log(`\n${'='.repeat(50)}`)
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log(`${'='.repeat(50)}`)
if (failed > 0) process.exit(1)
else console.log('ALL TESTS PASSED')
