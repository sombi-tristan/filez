import ExcelJS from 'exceljs'
import { addBlock, autoWidth, num, downloadWorkbook, safeName } from '@/lib/exportPlain'

/**
 * The Sales Operation report as a plain workbook, for every station outside the RAINOIL group
 * (lib/exportGroup.js); Rainoil stations export their own replica form
 * (lib/exportSalesOperationExcel.js), untouched. The same figures as the screen: a worksheet per
 * day (or shift) with Sales, Stock, Overage, Lodgements, Cash and Lube, and none of the Rainoil
 * form's budget or competitor prices.
 *
 * buildSalesOperationWorkbook makes the workbook (tests/sales-operation-generic.test.mjs reads
 * it); exportSalesOperationGenericExcel hands it to the browser.
 */
export async function buildSalesOperationWorkbook({ report, stationName, startDate, endDate }) {
  const wb = new ExcelJS.Workbook()
  wb.created = new Date()

  for (const sheet of report.sheets) {
    // A worksheet name may not carry \ / ? * [ ] : and is at most 31 characters.
    const ws = wb.addWorksheet(String(sheet.sheetName).replace(/[\\/?*[\]:]/g, '-').slice(0, 31))
    ws.addRow([stationName || 'Station']).font = { bold: true, size: 14 }
    ws.addRow([`Sales Operation, ${sheet.sheetName} (${startDate} to ${endDate})`]).font = { size: 10 }
    ws.addRow([])

    addBlock(ws, {
      title: 'Sales',
      header: ['Fuel', 'Price 1', 'Actual sales @P1', 'RTT @P1', 'Cons. @P1', 'Price 2', 'Actual sales @P2', 'RTT @P2', 'Cons. @P2', 'Total actual sales (L)', 'Amount'],
      rows: sheet.fuel.map((f) => [f.fuelType, num(f.price1), num(f.actualSalesP1), num(f.rttP1), num(f.consP1), num(f.price2), num(f.actualSalesP2), num(f.rttP2), num(f.consP2), num(f.totalActualLtrs), num(f.amount)]),
      total: ['Total', '', '', '', '', '', '', '', '', num(sheet.fuel.reduce((s, f) => s + f.totalActualLtrs, 0)), num(sheet.fuel.reduce((s, f) => s + f.amount, 0))],
    })

    addBlock(ws, {
      title: 'Stock',
      header: ['Fuel', 'Opening', 'Waybill', 'Actual received', 'Truck shortage', 'Total dispensed', 'Closing'],
      rows: sheet.stock.map((s) => [s.fuelType, num(s.opening), num(s.waybill), num(s.actualReceived), num(s.truckShortage), num(s.totalDispensed), num(s.closing)]),
    })

    addBlock(ws, {
      title: 'Overage',
      header: ['Fuel', 'Expected overage', 'Actual overage', 'Variance'],
      rows: (sheet.overage || []).map((o) => [o.fuelType, num(Math.round(o.expected)), num(Math.round(o.actual)), num(Math.round(o.variance))]),
    })

    const { deposits = [], pos = [], transfers = [] } = sheet.lodgements || {}
    const lodged = [
      ...deposits.map((d) => ['Bank deposit', d.bankName, num(d.amount)]),
      ...pos.map((d) => ['POS', d.bankName, num(d.amount)]),
      ...transfers.map((d) => ['Transfer', d.bankName, num(d.amount)]),
    ]
    addBlock(ws, {
      title: 'Lodgements',
      header: ['Type', 'Bank', 'Amount'],
      rows: lodged.length ? lodged : [['None', '', '']],
      total: ['Total', '', num(lodged.reduce((s, r) => s + (Number(r[2]) || 0), 0))],
    })

    const c = sheet.cash
    addBlock(ws, {
      title: 'Cash',
      header: ['Total expected sales', 'Previous day cash @ hand', 'Total bank deposit', 'Total POS & Transfer', 'Expected Cash @ Hand', 'Actual cash @ hand', 'Variance'],
      rows: [[num(c.totalExpectedSales), num(c.prevDayCash), num(c.totalBankDeposit), num(c.totalPOS + (c.totalTransfer || 0)), num(c.expectedCashAtHand), num(c.actualCashAtHand), num(c.variance)]],
    })

    if (sheet.lube?.length) {
      addBlock(ws, {
        title: 'Lube',
        header: ['Product', 'Litre', 'Unit price', 'Opening', 'Supply', 'Sales', 'Closing', 'Amount', 'Variance'],
        rows: sheet.lube.map((l) => [l.productName, num(l.litre), num(l.unitPrice), num(l.openingStock), num(l.productSupply), num(l.sales), num(l.closingStock), num(l.amount), num(l.variance)]),
        total: ['Total', '', '', '', '', num(sheet.lube.reduce((s, l) => s + l.sales, 0)), '', num(sheet.lube.reduce((s, l) => s + l.amount, 0)), ''],
      })
    }
    autoWidth(ws)
  }
  return wb
}

export async function exportSalesOperationGenericExcel({ report, stationName, startDate, endDate }) {
  const wb = await buildSalesOperationWorkbook({ report, stationName, startDate, endDate })
  return downloadWorkbook(wb, `Sales Operation ${safeName(stationName)} ${startDate} to ${endDate}.xlsx`)
}
