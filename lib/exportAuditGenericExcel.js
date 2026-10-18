import ExcelJS from 'exceljs'
import { addBlock, autoWidth, num, downloadWorkbook, safeName } from '@/lib/exportPlain'

/**
 * The audit report as a plain workbook, for every station outside the RAINOIL group.
 *
 * exportAuditExcel.js is a 2021-line replica of Rainoil's own audit pack: ten numbered sheets
 * ("1.Guideline", "2. Sales>>Cash Position", "8.Product Received"), their logo embedded, and
 * formulas wired between sheets. That is somebody's physical document, and it stays exactly as
 * it is. This is the other branch: the same figures, laid out plainly.
 *
 * It exports what the report already puts on screen rather than inventing an accounting
 * document. One sheet per section, headers, totals, and nothing else: no logo, no cross-sheet
 * formulas, no sheet numbering.
 *
 * Not included: the Calculator tab, which holds values an auditor types in while working
 * rather than anything the report computes, so there is nothing of record to export.
 */

export async function exportAuditGenericExcel({
  report, receipts, stationName, startDate, endDate,
}) {
  if (!report) throw new Error('No report data')

  const wb = new ExcelJS.Workbook()
  wb.created = new Date()

  const fuelTypes = report.fuelTypes || []
  const period = `${startDate} to ${endDate}`

  // ---- Sales / Cash Position ----------------------------------------------------------
  const sc = report.salesCash
  if (sc) {
    const ws = wb.addWorksheet('Sales & Cash Position')
    ws.addRow([stationName || 'Station']).font = { bold: true, size: 14 }
    ws.addRow([`Sales and Cash Position, ${period}`]).font = { size: 10 }
    ws.addRow([])

    for (const ft of fuelTypes) {
      const s = sc.fuelSummaries?.[ft]
      if (!s) continue
      addBlock(ws, {
        title: ft,
        header: ['Price', 'Dispensed (L)', 'Amount'],
        rows: (s.rows || []).map((r) => [num(r.price), num(r.dispensed), num(r.amount)]),
        total: ['Total', num(s.totalDispensed), num(s.totalAmount)],
      })
      addBlock(ws, {
        header: ['Measure', 'Quantity', 'Amount'],
        rows: [
          ['Pour back', num(s.totalPourBackQty), num(s.totalPourBackAmt)],
          ['Consumed', num(s.totalConsumedQty), num(s.totalConsumedAmt)],
          ['Net sales', num(s.netSalesQty), num(s.netSalesAmt)],
          ['Expected sales', num(s.expectedSalesQty), num(s.expectedSalesAmt)],
        ],
      })
    }

    const cash = sc.cashReconciliation
    if (cash && typeof cash === 'object') {
      addBlock(ws, {
        title: 'Cash reconciliation',
        header: ['Item', 'Amount'],
        // Named as the report names them on screen, not by the fields lib/buildAuditReport.js keeps.
        rows: [
          ['Expected Sales from Products for the Period', num(cash.expectedSalesTotal)],
          ['Total Lodgement for the Period', num(cash.totalLodgement)],
          ['Total POS for the Period', num(cash.totalPOS)],
          ['Total Transfer for the Period', num(cash.totalTransfer)],
          ['Overage/Shortage', num(cash.overshort)],
        ],
      })
    }
    autoWidth(ws)
  }

  // ---- Stock Position -----------------------------------------------------------------
  if (report.stockPosition) {
    const ws = wb.addWorksheet('Stock Position')
    ws.addRow([`Stock Position, ${period}`]).font = { bold: true, size: 12 }
    ws.addRow([])

    for (const ft of fuelTypes) {
      const sp = report.stockPosition[ft]
      if (!sp) continue
      addBlock(ws, {
        title: ft,
        header: ['Date', 'Opening', 'Supply', 'Qty sold', 'Closing', 'Dispensed', 'OV/SH', 'Actual OV/SH'],
        rows: (sp.rows || []).map((r) => [
          r.date, num(r.opening), num(r.supply), num(r.qtySold),
          num(r.closing), num(r.dispensed), num(r.ovsh), num(r.actualOvsh),
        ]),
        total: [
          'Total', num(sp.totals?.opening), num(sp.totals?.supply), num(sp.totals?.qtySold),
          num(sp.totals?.closing), num(sp.totals?.dispensed), num(sp.totals?.ovsh),
          num(sp.totals?.actualOvsh),
        ],
      })
      addBlock(ws, {
        header: ['Expected litres', 'Actual received', 'Truck/driver OV/SH'],
        rows: [[
          num(sp.totals?.expectedLitres),
          num(sp.totals?.actualLitresReceived),
          num(sp.totals?.truckDriverOvsh),
        ]],
      })
    }
    autoWidth(ws)
  }

  // ---- Lodgement Sheet ----------------------------------------------------------------
  const ls = report.lodgementSheet
  if (ls) {
    const ws = wb.addWorksheet('Lodgement Sheet')
    ws.addRow([`Lodgement Sheet, ${period}`]).font = { bold: true, size: 12 }
    ws.addRow([])

    const bankNames = (ls.banks || []).map((b) => b.bank_name || b.name || 'Bank')
    addBlock(ws, {
      header: ['Date', ...bankNames, 'Total'],
      rows: (ls.rows || []).map((r) => [
        r.date,
        ...(ls.banks || []).map((b) => num(r.byBank?.[b.id])),
        num(r.total),
      ]),
      total: [
        'Total',
        ...(ls.banks || []).map((b) => num(ls.totals?.byBank?.[b.id])),
        num(ls.totals?.total),
      ],
    })
    autoWidth(ws)
  }

  // ---- Consumption and Pour Back ------------------------------------------------------
  if (report.consumptionReport) {
    const ws = wb.addWorksheet('Consumption & Pour Back')
    ws.addRow([`Consumption and Pour Back, ${period}`]).font = { bold: true, size: 12 }
    ws.addRow([])

    for (const ft of fuelTypes) {
      const cr = report.consumptionReport[ft]
      if (!cr) continue
      const customers = cr.customers || []
      addBlock(ws, {
        title: ft,
        header: ['Date', 'Rate', ...customers.map((c) => c.name || 'Customer'), 'Pour back'],
        rows: (cr.rows || []).map((r) => [
          r.date, num(r.rate),
          ...customers.map((c) => num(r.customerQtys?.[c.id])),
          num(r.pourBack),
        ]),
        total: [
          'Total', '',
          ...customers.map((c) => num(cr.totals?.customerTotals?.[c.id])),
          num(cr.totals?.pourBack),
        ],
      })
    }
    autoWidth(ws)
  }

  // ---- Product Received ---------------------------------------------------------------
  // From the live receipts rather than the report: the audit screen reads them the same way.
  if (receipts && receipts.length > 0) {
    const ws = wb.addWorksheet('Product Received')
    ws.addRow([`Product Received, ${period}`]).font = { bold: true, size: 12 }
    ws.addRow([])
    addBlock(ws, {
      header: ['Date', 'Waybill', 'Truck', 'Driver', 'Depot', 'Volume (L)'],
      rows: receipts.map((r) => [
        r.entryDate || '',
        r.waybillNumber || '',
        r.truckNumber || '',
        r.driverName || '',
        r.depotName || '',
        num(r.actualVolume),
      ]),
      total: ['Total', '', '', '', '', num(receipts.reduce((s, r) => s + (Number(r.actualVolume) || 0), 0))],
    })
    autoWidth(ws)
  }

  return downloadWorkbook(
    wb,
    `Audit Report ${safeName(stationName)} ${startDate} to ${endDate}.xlsx`
  )
}
