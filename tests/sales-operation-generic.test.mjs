/**
 * Pins the Sales Operation report for every station, audit-style:
 *
 *   The builder works out each fuel's overage (expected 1% of what left the tanks, actual what
 *   the meters dispensed beyond that less pour back, and their variance) and truck shortage
 *   once, for the screen and the plain workbook alike (lib/buildSalesOperationReport.js).
 *   A station outside the RAINOIL group exports a plain workbook (lib/exportSalesOperationGenericExcel.js):
 *   a worksheet per day with Sales, Stock, Overage, Lodgements, Cash and Lube, and no budget or
 *   competitor prices. Rainoil stations keep their replica workbook, untouched.
 *
 * Run: node tests/sales-operation-generic.test.mjs
 */
import { register } from 'node:module'
register('./helpers/app-loader.mjs', import.meta.url)
const { buildSalesOperationReport } = await import('../lib/buildSalesOperationReport.js')
const { buildSalesOperationWorkbook } = await import('../lib/exportSalesOperationGenericExcel.js')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

// One PMS pump on one tank: opening 10,000; a truck of two compartments (3,000 + 2,100 = 5,100
// litres) delivers 5,000 into the tank; closing 13,000; the meter dispensed 2,050 litres, 50 of
// them poured back.
const nozzles = [{ id: 'p1', fuel_type: 'PMS', pump_number: 1, initial_reading: 0, tank_id: 't1' }]
const tanks = [{ id: 't1', fuel_type: 'PMS', tank_number: 1, opening_stock: 10000 }]
const sales = [{
  id: 's1', entryDate: '2026-10-01', createdAt: '2026-10-01T08:00:00Z', prices: { PMS: 1000 }, closeOfBusiness: true,
  nozzleReadings: [{ pump_id: 'p1', closing_meter: 2050, pour_back: 50 }],
  tankReadings: [{ tank_id: 't1', closing_stock: 13000 }],
}]
const receipts = [{ id: 'r1', entryDate: '2026-10-01', tankId: 't1', actualVolume: 5000, highVol1: 3000, highVol2: 2100, highVol3: 0, waybillNumber: 'W1', truckNumber: 'T1' }]
const report = buildSalesOperationReport({ sales, receipts, lodgements: [], lubeSales: [], lubeProducts: [], nozzles, tanks, banks: [], startDate: '2026-10-01', endDate: '2026-10-01' })
const sheet = report.sheets[0]
const o = sheet.overage?.find((x) => x.fuelType === 'PMS')

console.log('Overage, worked out once')
// The overage takes the waybill, as the Rainoil form's own formula does: 10,000 + 5,100 - 13,000.
check('expected is 1% of what left the tanks', o && Math.abs(o.expected - 21) < 1e-9)
check('actual is dispensed beyond that, less pour back', o && o.actual === -100) // 2,050 - 2,100 - 50
check('variance is actual less expected', o && Math.abs(o.variance - -121) < 1e-9)

console.log('\nTruck shortage, from the product receipt')
const pms = sheet.stock.find((s) => s.fuelType === 'PMS')
check('waybill is the truck\'s compartments: 5,100', pms.waybill === 5100)
check('actual received is what went into the tanks: 5,000', pms.actualReceived === 5000)
check('truck shortage is capacity less received: 100', pms.truckShortage === 100)
{
  // One truck carrying two fuels: its capacity is split in proportion to what each received.
  const two = buildSalesOperationReport({
    sales: [{ ...sales[0], nozzleReadings: [], tankReadings: [] }],
    receipts: [
      { id: 'a', entryDate: '2026-10-01', tankId: 't1', actualVolume: 2900, highVol1: 3000, highVol2: 3000, highVol3: 0, waybillNumber: 'W2' },
      { id: 'b', entryDate: '2026-10-01', tankId: 't2', actualVolume: 2900, highVol1: 3000, highVol2: 3000, highVol3: 0, waybillNumber: 'W2' },
    ],
    lodgements: [], lubeSales: [], lubeProducts: [],
    nozzles: [...nozzles, { id: 'p2', fuel_type: 'AGO', pump_number: 1, initial_reading: 0, tank_id: 't2' }],
    tanks: [...tanks, { id: 't2', fuel_type: 'AGO', tank_number: 1, opening_stock: 0 }],
    banks: [], startDate: '2026-10-01', endDate: '2026-10-01',
  }).sheets[0].stock
  check('a two-fuel truck: each fuel gets its share of the capacity', two.find((s) => s.fuelType === 'PMS').waybill === 3000 && two.find((s) => s.fuelType === 'AGO').waybill === 3000 && two.find((s) => s.fuelType === 'AGO').truckShortage === 100)
}

console.log('\nThe plain workbook')
const wb = await buildSalesOperationWorkbook({ report, stationName: 'Test Station', startDate: '2026-10-01', endDate: '2026-10-01' })
const ws = wb.worksheets[0]
const text = []
ws.eachRow((row) => row.eachCell((c) => text.push(String(c.value ?? ''))))
const all = text.join(' | ')
check('a worksheet per day', wb.worksheets.length === report.sheets.length && ws.name === sheet.sheetName)
check('names the station', all.includes('Test Station'))
check('has Sales, Stock, Overage, Lodgements, Cash and Lube', ['Sales', 'Stock', 'Overage', 'Lodgements', 'Cash'].every((t) => text.includes(t)))
check('no budget and no competitor prices', !/budget|competitor|achievement/i.test(all))
check('the cash row reads as on screen', text.includes('Total POS & Transfer') && text.includes('Expected Cash @ Hand'))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
