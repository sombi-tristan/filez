import ExcelJS from 'exceljs'

// ── Colour palette (ARGB, no leading #) ─────────────────────────────────────
const C = {
  HDR_BG:  'FF2563EB', // bg-blue-600
  HDR_FG:  'FFFFFFFF', // text-white
  SUB_BG:  'FFEFF6FF', // bg-blue-50
  SUB_FG:  'FF2563EB', // text-blue-600
  BDR:     'FFBFDBFE', // border-blue-200
  BLACK:   'FF000000',
  RED:     'FFDC2626',
  GREEN:   'FF16A34A',
}

const THIN = (argb) => ({ style: 'thin', color: { argb } })
const BORDER = {
  top: THIN(C.BDR), left: THIN(C.BDR), bottom: THIN(C.BDR), right: THIN(C.BDR),
}

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Cell writer ──────────────────────────────────────────────────────────────
// style: 'hdr' | 'subhdr' | 'subtotal' | 'bold' | 'body' | 'red' | 'green'
function sc(ws, row, col, value, style, align = 'left') {
  const c = ws.getCell(row, col)
  c.value = value ?? ''
  c.border = BORDER
  c.alignment = { horizontal: align, vertical: 'middle', wrapText: false }

  switch (style) {
    case 'hdr':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.HDR_BG } }
      c.font = { bold: true, size: 9, color: { argb: C.HDR_FG } }
      break
    case 'subhdr':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SUB_BG } }
      c.font = { bold: true, size: 9, color: { argb: C.SUB_FG } }
      break
    case 'subtotal':
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.SUB_BG } }
      c.font = { bold: true, size: 9, color: { argb: C.BLACK } }
      break
    case 'bold':
      c.font = { bold: true, size: 9, color: { argb: C.BLACK } }
      break
    case 'red':
      c.font = { size: 9, color: { argb: C.RED } }
      break
    case 'green':
      c.font = { size: 9, color: { argb: C.GREEN } }
      break
    default: // 'body'
      c.font = { size: 9, color: { argb: C.BLACK } }
  }
  return c
}

// Fill an entire row range with empty cells in given style (used for hdr spanning)
function fillRange(ws, row, c1, c2, style) {
  for (let c = c1; c <= c2; c++) sc(ws, row, c, '', style)
}

// ── Column layout ────────────────────────────────────────────────────────────
// LEFT  (pumps):   cols 1-8  (A-H)
// GAP:             col  9    (I)
// RIGHT (summary): cols 10-16 (J-P)
const L = { label: 1, opening: 2, closing: 3, dispensed: 4, consumed: 5, actual: 6, price: 7, amount: 8 }
const R = { label: 10, c2: 11, c3: 12, c4: 13, c5: 14, c6: 15, c7: 16 }

function setColWidths(ws) {
  const widths = [18, 11, 11, 11, 11, 11, 10, 13, 2, 22, 11, 11, 11, 11, 11, 11]
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.properties.defaultRowHeight = 15
}

// ── Sheet builder ────────────────────────────────────────────────────────────
function buildSheet(ws, dr, fuelTypes, customerMap) {
  setColWidths(ws)

  let lr = 1 // left row cursor
  let rr = 1 // right row cursor

  // ── LEFT: Pumps table ──────────────────────────────────────────────────────

  // Header
  sc(ws, lr, L.label,     'Pumps',     'subhdr', 'left')
  sc(ws, lr, L.opening,   'Opening',   'subhdr', 'right')
  sc(ws, lr, L.closing,   'Closing',   'subhdr', 'right')
  sc(ws, lr, L.dispensed, 'Dispensed', 'subhdr', 'right')
  sc(ws, lr, L.consumed,  'Consumed',  'subhdr', 'right')
  sc(ws, lr, L.actual,    'Actual',    'subhdr', 'right')
  sc(ws, lr, L.price,     'Price',     'subhdr', 'right')
  sc(ws, lr, L.amount,    'Amount',    'subhdr', 'right')
  lr++

  for (const group of dr.entryGroups) {
    // Entry header (only when multiple entries)
    if (dr.entryCount > 1) {
      sc(ws, lr, L.label, `Entry ${group.entryIndex}`, 'hdr', 'left')
      fillRange(ws, lr, L.opening, L.amount, 'hdr')
      ws.mergeCells(lr, L.label, lr, L.amount)
      lr++
    }

    for (const { rows, totals } of group.nozzleRows) {
      // Individual nozzle rows
      for (const r of rows) {
        sc(ws, lr, L.label,     r.label,          'bold', 'left')
        sc(ws, lr, L.opening,   fmt(r.opening),   'body', 'right')
        sc(ws, lr, L.closing,   fmt(r.closing),   'body', 'right')
        sc(ws, lr, L.dispensed, fmt(r.dispensed), 'body', 'right')
        sc(ws, lr, L.consumed,  fmt(r.consumed), 'body', 'right')
        sc(ws, lr, L.actual,    '', 'body', 'right')
        sc(ws, lr, L.price,     '', 'body', 'right')
        sc(ws, lr, L.amount,    '', 'body', 'right')
        lr++
      }

      // Fuel-type subtotal row (bg-blue-50 font-bold)
      sc(ws, lr, L.label,     '',                   'subtotal', 'left')
      sc(ws, lr, L.opening,   '',                   'subtotal', 'right')
      sc(ws, lr, L.closing,   '',                   'subtotal', 'right')
      sc(ws, lr, L.dispensed, fmt(totals.dispensed), 'subtotal', 'right')
      sc(ws, lr, L.consumed,  fmt(totals.consumed),  'subtotal', 'right')
      sc(ws, lr, L.actual,    fmt(totals.actual),    'subtotal', 'right')
      sc(ws, lr, L.price,     fmt(totals.price),     'subtotal', 'right')
      sc(ws, lr, L.amount,    fmt(totals.amount),    'subtotal', 'right')
      lr++
    }
  }

  // DAY TOTAL row (only when multiple entries)
  if (dr.entryCount > 1) {
    const totDisp   = fuelTypes.reduce((s, ft) => s + dr.dayFuelTotals[ft].dispensed, 0)
    const totCons   = fuelTypes.reduce((s, ft) => s + dr.dayFuelTotals[ft].consumed + (dr.dayFuelTotals[ft].pourBack || 0), 0) // pour back is consumption here
    const totActual = fuelTypes.reduce((s, ft) => s + dr.dayFuelTotals[ft].actual, 0)
    const totAmount = fuelTypes.reduce((s, ft) => s + dr.dayFuelTotals[ft].amount, 0)
    sc(ws, lr, L.label,     'DAY TOTAL',      'hdr', 'left')
    sc(ws, lr, L.opening,   '',               'hdr', 'right')
    sc(ws, lr, L.closing,   '',               'hdr', 'right')
    sc(ws, lr, L.dispensed, fmt(totDisp),     'hdr', 'right')
    sc(ws, lr, L.consumed,  fmt(totCons),     'hdr', 'right')
    sc(ws, lr, L.actual,    fmt(totActual),   'hdr', 'right')
    sc(ws, lr, L.price,     '',               'hdr', 'right')
    sc(ws, lr, L.amount,    fmt(totAmount),   'hdr', 'right')
    lr++
  }

  // ── RIGHT: Tank stock table ────────────────────────────────────────────────

  sc(ws, rr, R.label, 'Tank',      'subhdr', 'left')
  sc(ws, rr, R.c2,    'Opening',   'subhdr', 'right')
  sc(ws, rr, R.c3,    'Supply',    'subhdr', 'right')
  sc(ws, rr, R.c4,    'Closing',   'subhdr', 'right')
  sc(ws, rr, R.c5,    'Diff',      'subhdr', 'right')
  sc(ws, rr, R.c6,    'Dispensed', 'subhdr', 'right')
  sc(ws, rr, R.c7,    'OV/SH',     'subhdr', 'right')
  rr++

  for (const row of dr.tankSummaryRows) {
    for (const t of row.tanks) {
      const ovsh = t.ovsh
      const ovshStyle = ovsh < 0 ? 'red' : ovsh > 0 ? 'green' : 'body'
      sc(ws, rr, R.label, t.label,          'bold',     'left')
      sc(ws, rr, R.c2,    fmt(t.opening),   'body',     'right')
      sc(ws, rr, R.c3,    t.supply ? fmt(t.supply) : '', 'body', 'right')
      sc(ws, rr, R.c4,    fmt(t.closing),   'body',     'right')
      sc(ws, rr, R.c5,    fmt(t.diff),      'body',     'right')
      sc(ws, rr, R.c6,    fmt(t.dispensed), 'body',     'right')
      sc(ws, rr, R.c7,    (ovsh > 0 ? '+' : '') + fmt(ovsh), ovshStyle, 'right')
      rr++
    }

    if (row.tanks.length > 1) {
      const tOvsh = row.totalOvsh
      sc(ws, rr, R.label, 'Total',                        'subhdr', 'left')
      sc(ws, rr, R.c2,    fmt(row.totalOpening),          'subhdr', 'right')
      sc(ws, rr, R.c3,    row.totalSupply ? fmt(row.totalSupply) : '', 'subhdr', 'right')
      sc(ws, rr, R.c4,    fmt(row.totalClosing),          'subhdr', 'right')
      sc(ws, rr, R.c5,    fmt(row.totalDiff),             'subhdr', 'right')
      sc(ws, rr, R.c6,    fmt(row.totalDispensed),        'subhdr', 'right')
      const tOvshCell = sc(ws, rr, R.c7, (tOvsh > 0 ? '+' : '') + fmt(tOvsh), 'subhdr', 'right')
      if (tOvsh < 0) tOvshCell.font = { bold: true, size: 9, color: { argb: C.RED } }
      else if (tOvsh > 0) tOvshCell.font = { bold: true, size: 9, color: { argb: C.GREEN } }
      rr++
    }
  }

  rr++ // spacer

  // ── RIGHT: Lodgements table ────────────────────────────────────────────────

  sc(ws, rr, R.label, 'Account', 'subhdr', 'left')
  sc(ws, rr, R.c2,    'Amount',  'subhdr', 'right')
  fillRange(ws, rr, R.c3, R.c7, 'subhdr')
  rr++

  const lodgedRows = dr.lodgement.bankRows.filter(r => r.deposited > 0)
  if (lodgedRows.length === 0) {
    sc(ws, rr, R.label, 'No lodgements', 'body', 'left')
    sc(ws, rr, R.c2,    '', 'body', 'right')
    fillRange(ws, rr, R.c3, R.c7, 'body')
    rr++
  } else {
    for (const row of lodgedRows) {
      const type = row.lodgementType === 'bank_deposit' ? 'deposit' : row.lodgementType
      const label = `${row.bankName}${row.terminalId ? ` - ${row.terminalId}` : ''} (${type})`
      sc(ws, rr, R.label, label,              'bold', 'left')
      sc(ws, rr, R.c2,    fmt(row.deposited), 'body', 'right')
      fillRange(ws, rr, R.c3, R.c7, 'body')
      rr++
    }
    sc(ws, rr, R.label, 'Total Lodged',             'subhdr', 'left')
    sc(ws, rr, R.c2,    fmt(dr.lodgement.totalAll), 'subhdr', 'right')
    fillRange(ws, rr, R.c3, R.c7, 'subhdr')
    rr++
  }

  rr++ // spacer

  // ── RIGHT: Consumption entries (optional) ──────────────────────────────────
  // Split into two sections: Consumption then Pour Back.

  {
    const consEntries = dr.consumption.entries.filter(e => !e.isPourBack)
    const pbEntries = dr.consumption.entries.filter(e => e.isPourBack)

    const renderSection = (title, items) => {
      if (items.length === 0) return
      sc(ws, rr, R.label, title, 'subhdr', 'left')
      fillRange(ws, rr, R.c2, R.c7, 'subhdr')
      rr++
      sc(ws, rr, R.label, 'Account', 'subhdr', 'left')
      sc(ws, rr, R.c2,    'Fuel',    'subhdr', 'left')
      sc(ws, rr, R.c3,    'Qty',     'subhdr', 'right')
      fillRange(ws, rr, R.c4, R.c7, 'subhdr')
      rr++
      for (const entry of items) {
        sc(ws, rr, R.label, customerMap[entry.customerId] || 'Unknown', 'body', 'left')
        sc(ws, rr, R.c2,    entry.fuelType || '',                        'body', 'left')
        sc(ws, rr, R.c3,    fmt(entry.quantity),                         'body', 'right')
        fillRange(ws, rr, R.c4, R.c7, 'body')
        rr++
      }
      rr++ // spacer
    }

    renderSection('Consumption', consEntries)
    renderSection('Pour Back', pbEntries)
  }

  // ── RIGHT: Summary table ───────────────────────────────────────────────────

  sc(ws, rr, R.label, '',       'subhdr', 'left')
  sc(ws, rr, R.c2,    'P/b',   'subhdr', 'right')
  sc(ws, rr, R.c3,    'Sales', 'subhdr', 'right')
  sc(ws, rr, R.c4,    'Amount','subhdr', 'right')
  fillRange(ws, rr, R.c5, R.c7, 'subhdr')
  rr++

  for (const ft of fuelTypes) {
    const t = dr.dayFuelTotals[ft]
    sc(ws, rr, R.label, ft,               'bold', 'left')
    sc(ws, rr, R.c2,    fmt(t?.pourBack), 'body', 'right')
    sc(ws, rr, R.c3,    fmt(t?.actual),   'body', 'right')
    sc(ws, rr, R.c4,    fmt(t?.amount),   'body', 'right')
    fillRange(ws, rr, R.c5, R.c7, 'body')
    rr++
  }

  // SALES
  sc(ws, rr, R.label, 'SALES',           'subhdr', 'left')
  sc(ws, rr, R.c2,    '',                'subhdr', 'left')
  sc(ws, rr, R.c3,    '',                'subhdr', 'left')
  sc(ws, rr, R.c4,    fmt(dr.totalSales),'subhdr', 'right')
  fillRange(ws, rr, R.c5, R.c7, 'subhdr')
  rr++

  // POS/Transfer sub-rows (non-bank_deposit)
  for (const row of dr.lodgement.bankRows.filter(r => r.lodgementType !== 'bank_deposit' && r.deposited > 0)) {
    const label = `${row.bankName}${row.terminalId ? ` - ${row.terminalId}` : ''}${row.lodgementType !== 'pos' && row.lodgementType !== 'transfer' ? ` (${row.lodgementType})` : ''}`
    sc(ws, rr, R.label, label,              'body', 'left')
    sc(ws, rr, R.c2,    '',                 'body', 'left')
    sc(ws, rr, R.c3,    '',                 'body', 'left')
    sc(ws, rr, R.c4,    fmt(row.deposited), 'body', 'right')
    fillRange(ws, rr, R.c5, R.c7, 'body')
    rr++
  }

  // TOTAL POS
  sc(ws, rr, R.label, 'TOTAL POS',              'bold', 'left')
  sc(ws, rr, R.c2,    '',                        'bold', 'left')
  sc(ws, rr, R.c3,    '',                        'bold', 'left')
  sc(ws, rr, R.c4,    fmt(dr.lodgement.totalPOS),'bold', 'right')
  fillRange(ws, rr, R.c5, R.c7, 'body')
  rr++

  // TOTAL TRANSFER
  sc(ws, rr, R.label, 'TOTAL TRANSFER',                   'bold', 'left')
  sc(ws, rr, R.c2,    '',                                  'bold', 'left')
  sc(ws, rr, R.c3,    '',                                  'bold', 'left')
  sc(ws, rr, R.c4,    fmt(dr.lodgement.totalTransfer),     'bold', 'right')
  fillRange(ws, rr, R.c5, R.c7, 'body')
  rr++

  // CASH
  sc(ws, rr, R.label, 'CASH',              'subhdr', 'left')
  sc(ws, rr, R.c2,    '',                  'subhdr', 'left')
  sc(ws, rr, R.c3,    '',                  'subhdr', 'left')
  sc(ws, rr, R.c4,    fmt(dr.cashBalance), 'subhdr', 'right')
  fillRange(ws, rr, R.c5, R.c7, 'subhdr')
}

// ── Public export function ───────────────────────────────────────────────────
export async function exportDailyReportExcel({ report, customerMap = {}, stationName = '', startDate, endDate }) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Filez'

  const days = report.dateReports.slice(0, 32)
  for (const dr of days) {
    const ws = wb.addWorksheet(dr.date)
    buildSheet(ws, dr, report.fuelTypes, customerMap)
  }

  const filename = stationName
    ? `${stationName} - Daily Report ${startDate} to ${endDate}.xlsx`
    : `Daily Report ${startDate} to ${endDate}.xlsx`

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
