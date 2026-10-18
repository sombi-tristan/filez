/**
 * Export the "Sales Operation" report to .xlsx, matching the August 2023
 * Lucky Way Station reference template exactly — palette, font, borders,
 * merges, and number formats inspected from the source file.
 */

import ExcelJS from 'exceljs'

// ─── Palette (inspected from reference) ─────────────────────────────────
const SECTION_BG = 'FFBDD6EE' // section title rows + blank separator rows' col A
const LABEL_BG   = 'FFB4C6E7' // "Station", "Date" label cells in col B (R1-R2 only)
const HEADER_BG  = 'FFF4B083' // orange — column headers ("Price 1", "Opening stock", etc.)
const FUEL_BG    = 'FFC5E0B3' // green — entire col A from R4 to R38
const YELLOW_BG  = 'FFFFFF00' // total/formula output cells
const GRAY_BG    = 'FFD8D8D8' // merged blank blocks (B8:J8 LUBES middle, H10:K13 stock right)

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } })

// ─── Fonts ──────────────────────────────────────────────────────────────
const FONT      = { name: 'Corbel', size: 9, color: { theme: 1 } }
const FONT_BOLD = { name: 'Corbel', size: 9, bold: true, color: { theme: 1 } }
// The header rows whose text wraps (R4 fuel, R15 recon, R20 deposits and POS): tall enough for
// three lines at 9pt, or Excel keeps them one line high and cuts the text off.
const HEADER_ROW_HEIGHT = 36

// ─── Borders ────────────────────────────────────────────────────────────
const BLACK = 'FF000000'
const GRAY  = 'FF7F7F7F'
const thin   = (argb = BLACK) => ({ style: 'thin',   color: { argb } })
const med    = (argb = BLACK) => ({ style: 'medium', color: { argb } })
const thick  = (argb = BLACK) => ({ style: 'thick',  color: { argb } })

// ─── Number formats ─────────────────────────────────────────────────────
const NUM_FMT  = '#,##0 ;[Red](#,##0)'
const DATE_FMT = '[$]dddd, mmmm d, yyyy'

// ─── Column widths (from reference) ────────────────────────────────────
// Match the reference's column widths exactly. Large values may show #######
// in cells too narrow to display them, same as the reference would.
const WIDTHS = [8.71, 8.71, 8.71, 8.71, 9.57, 10.86, 10, 14.14, 8.71, 8.71, 8.71]

function setColWidths(ws) {
  WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  ws.properties.defaultRowHeight = 15
}

// Reference has NO explicit row heights — Excel auto-fits rows containing
// wrap-text cells based on content. We intentionally do NOT set heights here
// so the export inherits the same auto-fit behavior and rows look consistent.

// Unlock input cells (non-formula). Combined with ws.protect('') below, this
// makes formula cells read-only and input cells editable.
function unlockInputCells(ws) {
  const maxRow = ws.rowCount || 0
  const maxCol = ws.columnCount || 0
  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r)
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c)
      const isFormula = cell.value && typeof cell.value === 'object' && cell.value.formula
      if (!isFormula) {
        cell.protection = { locked: false }
      }
    }
  }
}

function applyStyle(cell, { font, fill, border, alignment, numFmt, value }) {
  if (value !== undefined) cell.value = value
  if (font)      cell.font = font
  if (fill)      cell.fill = fill
  if (border)    cell.border = border
  if (alignment) cell.alignment = alignment
  if (numFmt)    cell.numFmt = numFmt
}

// ─── Cell helpers ───────────────────────────────────────────────────────
function setCell(ws, r, c, value, opts = {}) {
  const cell = ws.getCell(r, c)
  cell.value = value == null ? '' : value
  applyStyle(cell, {
    font: opts.font || FONT,
    fill: opts.fill,
    border: opts.border,
    alignment: opts.alignment || { horizontal: opts.align || 'center', vertical: 'middle' },
    numFmt: opts.numFmt,
  })
  return cell
}

function setNum(ws, r, c, value, opts = {}) {
  const cell = ws.getCell(r, c)
  cell.value = (value == null || value === '' || (typeof value === 'number' && isNaN(value))) ? null : Number(value)
  applyStyle(cell, {
    font: opts.font || FONT_BOLD,
    fill: opts.fill,
    border: opts.border,
    alignment: opts.alignment || { horizontal: 'center', vertical: 'middle' },
    numFmt: opts.numFmt || NUM_FMT,
  })
  return cell
}

function setFormula(ws, r, c, formula, result, opts = {}) {
  const cell = ws.getCell(r, c)
  cell.value = { formula, result }
  applyStyle(cell, {
    font: opts.font || FONT_BOLD,
    fill: opts.fill,
    border: opts.border,
    alignment: opts.alignment || { horizontal: 'center', vertical: 'middle' },
    numFmt: opts.numFmt || NUM_FMT,
  })
  return cell
}

// Border preset for a single section-title row (medium top+bottom, thick left/right edges)
function sectionTitleBorder(isLeftEdge, isRightEdge) {
  return {
    top: med(),
    bottom: med(),
    left: isLeftEdge ? thick() : thin(GRAY),
    right: isRightEdge ? thick() : thin(GRAY),
  }
}

// Header row border (medium top+bottom, gray internal, thick outer)
function headerBorder(isLeftEdge, isRightEdge) {
  return {
    top: med(),
    bottom: med(),
    left: isLeftEdge ? thick() : thin(GRAY),
    right: isRightEdge ? thick() : thin(GRAY),
  }
}

// Data row border (thin BLACK internal, thick outer)
// Reference uses thin black on most data cells (only R5/R6 fuel rows are gray —
// an inconsistency in the source; we standardise to black for the rest).
function dataBorder(isLeftEdge, isRightEdge, opts = {}) {
  return {
    top: opts.top || thin(),
    bottom: opts.bottom || thin(),
    left: isLeftEdge ? thick() : thin(),
    right: isRightEdge ? thick() : thin(),
  }
}

function buildSheet(ws, sheet, stationName) {
  setColWidths(ws)

  const FUEL_ROWS  = { PMS: 5,  AGO: 6,  DPK: 7 }
  const STOCK_ROWS = { PMS: 11, AGO: 12, DPK: 13 }
  const RECON_ROWS = { PMS: 16, AGO: 17, DPK: 18 }
  const BUDGET_ROWS = { PMS: 28, AGO: 29, DPK: 30 }
  const COMP_ROWS   = { PMS: 34, AGO: 35, DPK: 36 }

  const fuelByType = Object.fromEntries(sheet.fuel.map(f => [f.fuelType, f]))
  const stockByType = Object.fromEntries(sheet.stock.map(s => [s.fuelType, s]))

  // ─── R1: Station header ─────────────────────────────────────────────
  // A1:A2 corner — replicate the reference's broken array formula =A1:O41
  // which evaluates to #REF! (deliberate "manual edit" quirk in source).
  const cornerCell = ws.getCell(1, 1)
  cornerCell.value = { formula: 'A1:O41', result: '#REF!' }
  applyStyle(cornerCell, {
    font: FONT_BOLD,
    fill: fill(LABEL_BG),
    border: { top: thick(), bottom: thin(), left: thick(), right: thin() },
    alignment: { horizontal: 'center', vertical: 'middle' },
  })
  setCell(ws, 1, 2, 'Station', {
    font: FONT_BOLD, fill: fill(LABEL_BG), align: 'center',
    border: { top: thick(), bottom: thin(), left: thin(), right: thin() },
  })
  setCell(ws, 1, 3, stationName || '', {
    font: FONT_BOLD, align: 'left',
    border: { top: thick(), bottom: thin(), left: thin(), right: thick() },
  })
  for (let c = 4; c <= 10; c++) {
    setCell(ws, 1, c, '', { font: FONT_BOLD, border: { top: thick(), bottom: thin() } })
  }
  setCell(ws, 1, 11, '', {
    font: FONT_BOLD, border: { top: thick(), bottom: thin(), right: thick() },
  })
  ws.mergeCells(1, 3, 1, 11)
  ws.mergeCells(1, 1, 2, 1) // A1:A2 corner cell

  // ─── R2: Date + times ───────────────────────────────────────────────
  setCell(ws, 2, 1, '', {
    fill: fill(LABEL_BG),
    border: { top: thin(), bottom: med(), left: thick(), right: thin() },
  })
  setCell(ws, 2, 2, 'Date', {
    font: FONT_BOLD, fill: fill(LABEL_BG), align: 'center',
    border: { top: thin(), bottom: med(), left: thin(), right: thin() },
  })

  // Date value — store as Date with custom format
  const dateCell = ws.getCell(2, 3)
  dateCell.value = new Date(sheet.date + 'T12:00:00')
  applyStyle(dateCell, {
    font: FONT, align: 'left',
    alignment: { horizontal: 'left', vertical: 'middle' },
    numFmt: DATE_FMT,
    border: { top: thin(), bottom: med(), left: thin(), right: thin() },
  })
  for (let c = 4; c <= 5; c++) {
    setCell(ws, 2, c, '', { border: { top: thin(), bottom: med() } })
  }
  ws.mergeCells(2, 3, 2, 5)

  setCell(ws, 2, 6, 'Opening Time', {
    font: FONT_BOLD, fill: fill(LABEL_BG), align: 'center',
    border: { top: thin(), bottom: med(), left: thin(), right: thin() },
  })
  setCell(ws, 2, 7, '6;00am', {
    font: FONT, align: 'left',
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: { top: thin(), bottom: med(), left: thin(), right: thin() },
  })
  setCell(ws, 2, 8, '', { border: { top: thin(), bottom: med() } })
  ws.mergeCells(2, 7, 2, 8)

  setCell(ws, 2, 9, 'Closing Time', {
    font: FONT_BOLD, fill: fill(LABEL_BG), align: 'center',
    border: { top: thin(), bottom: med(), left: thin(), right: thin() },
  })
  setCell(ws, 2, 10, '9;00pm', {
    font: FONT, align: 'left',
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: { top: thin(), bottom: med(), left: thin(), right: thin() },
  })
  setCell(ws, 2, 11, '', {
    border: { top: thin(), bottom: med(), right: thick() },
  })
  ws.mergeCells(2, 10, 2, 11)

  // ─── R3: blank separator (merged) — col A anchor gets section blue ──
  setCell(ws, 3, 1, '', {
    fill: fill(SECTION_BG),
    border: { left: thick(), right: undefined },
  })
  for (let c = 2; c <= 11; c++) {
    setCell(ws, 3, c, '', {
      fill: fill(SECTION_BG),
      border: { right: c === 11 ? thick() : undefined },
    })
  }
  ws.mergeCells(3, 1, 3, 11)

  // ─── R4: Fuel headers (orange) — col A stays green per reference ────
  ws.getRow(4).height = HEADER_ROW_HEIGHT
  setCell(ws, 4, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  const fuelHeaders = ['Price 1', 'Actual Sales @P1', 'RTT @P1', 'Cons. @P1',
                       'Price 2', 'Actual Sales @P2', 'RTT @P2', 'Cons. @P2',
                       'Total Actual Sales (Ltrs)', 'Amount (N)']
  fuelHeaders.forEach((h, i) => {
    const col = 2 + i
    setCell(ws, 4, col, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, col === 11),
      numFmt: NUM_FMT,
    })
  })

  // ─── R5–R7: PMS/AGO/DPK fuel rows ───────────────────────────────────
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = FUEL_ROWS[ft]
    const f = fuelByType[ft] || {}
    setCell(ws, row, 1, ft, {
      font: FONT, fill: fill(FUEL_BG),
      border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
    })
    const fuelBorder = dataBorder(false, false)
    setNum(ws, row, 2,  f.price1,        { border: fuelBorder })
    setNum(ws, row, 3,  f.actualSalesP1, { border: fuelBorder })
    setNum(ws, row, 4,  f.rttP1,         { border: fuelBorder })
    setNum(ws, row, 5,  f.consP1,        { border: fuelBorder })
    setNum(ws, row, 6,  f.price2,        { border: fuelBorder })
    setNum(ws, row, 7,  f.actualSalesP2, { border: fuelBorder })
    setNum(ws, row, 8,  f.rttP2,         { border: fuelBorder })
    setNum(ws, row, 9,  f.consP2,        { border: fuelBorder })
    setFormula(ws, row, 10, `C${row}+G${row}`, f.totalActualLtrs || 0, {
      fill: fill(YELLOW_BG),
      border: fuelBorder,
    })
    setFormula(ws, row, 11, `(B${row}*C${row})+(F${row}*G${row})`, f.amount || 0, {
      fill: fill(YELLOW_BG),
      border: dataBorder(false, true),
    })
  }

  // ─── R8: LUBES row (B8:J8 merged with gray fill) ───────────────────
  setCell(ws, 8, 1, 'LUBES', {
    font: FONT, fill: fill(FUEL_BG),
    border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
  })
  setCell(ws, 8, 2, '', { fill: fill(GRAY_BG), border: dataBorder(false, false) })
  for (let c = 3; c <= 10; c++) {
    setCell(ws, 8, c, '', { fill: fill(GRAY_BG), border: { top: thin(GRAY), bottom: thin(GRAY) } })
  }
  ws.mergeCells(8, 2, 8, 10)
  // K8 wired up after lube total row known

  // ─── R9: STOCK INVENTORY title (A9:K9 merged) ───────────────────────
  setCell(ws, 9, 1, 'STOCK INVENTORY (LITRES)', {
    font: FONT_BOLD, fill: fill(SECTION_BG),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: sectionTitleBorder(true, true),
    numFmt: NUM_FMT,
  })
  for (let c = 2; c <= 11; c++) {
    setCell(ws, 9, c, '', { fill: fill(SECTION_BG), border: { top: med(), bottom: med() } })
  }
  ws.mergeCells(9, 1, 9, 11)

  // ─── R10: stock headers (col A green; H10:K13 merged gray block) ────
  setCell(ws, 10, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  const stockHeaders = ['Opening stock', 'Waybill Qty Supplied', 'Actual Qty Received', 'Truck Shortage', 'Total Dispensed', 'Closing stock']
  stockHeaders.forEach((h, i) => {
    setCell(ws, 10, 2 + i, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, false),
      numFmt: NUM_FMT,
    })
  })
  // H10:K13 — merged gray empty block (reference uses cols A-G for stock data)
  setCell(ws, 10, 8, '', {
    fill: fill(GRAY_BG),
    border: { top: med(), bottom: thin(), left: thin(), right: thick() },
  })
  for (let r = 10; r <= 13; r++) {
    for (let c = 9; c <= 11; c++) {
      setCell(ws, r, c, '', { fill: fill(GRAY_BG), border: c === 11 ? { right: thick() } : {} })
    }
  }
  ws.mergeCells(10, 8, 13, 11)

  // ─── R11–R13: stock rows ────────────────────────────────────────────
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = STOCK_ROWS[ft]
    const fuelRow = FUEL_ROWS[ft]
    const s = stockByType[ft] || {}
    setCell(ws, row, 1, ft, {
      font: FONT, fill: fill(FUEL_BG),
      border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
    })
    const bdr = (top, bottom) => ({ top: top || thin(), bottom: bottom || thin(), left: thin(), right: thin() })
    const isFirst = row === 11
    const isLast  = row === 13
    const topB    = isFirst ? med() : thin()
    const botB    = isLast  ? med() : thin()
    setNum(ws, row, 2, s.opening,        { border: bdr(topB, botB) })
    setNum(ws, row, 3, s.waybill,        { border: bdr(topB, botB) })
    setNum(ws, row, 4, s.actualReceived, { border: bdr(topB, botB) })
    setFormula(ws, row, 5, `D${row}-C${row}`, (s.actualReceived || 0) - (s.waybill || 0), {
      fill: fill(YELLOW_BG), border: bdr(topB, botB),
    })
    setFormula(ws, row, 6, `C${fuelRow}+D${fuelRow}+E${fuelRow}+G${fuelRow}+H${fuelRow}+I${fuelRow}`, s.totalDispensed || 0, {
      fill: fill(YELLOW_BG), border: bdr(topB, botB),
    })
    setNum(ws, row, 7, s.closing,        { border: { ...bdr(topB, botB), right: thin() } })
  }

  // ─── R14: STOCK RECONCILIATION title ────────────────────────────────
  setCell(ws, 14, 1, 'STOCK RECONCILIATION (Litres)', {
    font: FONT_BOLD, fill: fill(SECTION_BG),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: sectionTitleBorder(true, true),
    numFmt: NUM_FMT,
  })
  for (let c = 2; c <= 11; c++) {
    setCell(ws, 14, c, '', { fill: fill(SECTION_BG), border: { top: med(), bottom: med() } })
  }
  ws.mergeCells(14, 1, 14, 11)

  // ─── R15: recon headers (col A green) ───────────────────────────────
  ws.getRow(15).height = HEADER_ROW_HEIGHT
  setCell(ws, 15, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  ;['Expected Overage', 'Actual Overage', 'Variance'].forEach((h, i) => {
    setCell(ws, 15, 2 + i, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, false),
      numFmt: NUM_FMT,
    })
  })
  // E15:K15 — merged empty header section
  for (let c = 5; c <= 11; c++) {
    setCell(ws, 15, c, '', {
      fill: fill(HEADER_BG),
      border: { top: med(), bottom: med(), right: c === 11 ? thick() : undefined },
    })
  }
  ws.mergeCells(15, 5, 15, 11)

  // ─── R16–R18: recon rows ────────────────────────────────────────────
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = RECON_ROWS[ft]
    const stockRow = STOCK_ROWS[ft]
    const fuelRow  = FUEL_ROWS[ft]
    const s = stockByType[ft] || {}
    const f = fuelByType[ft]  || {}
    const expectedOverage = ((s.opening || 0) + (s.waybill || 0) - (s.closing || 0)) * 0.01
    const actualOverage = (s.totalDispensed || 0) - ((s.opening || 0) + (s.waybill || 0) - (s.closing || 0)) - ((f.rttP1 || 0) + (f.rttP2 || 0))
    const variance = actualOverage - expectedOverage

    setCell(ws, row, 1, ft, {
      font: FONT, fill: fill(FUEL_BG),
      border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
    })
    setFormula(ws, row, 2, `(B${stockRow}+C${stockRow}-G${stockRow})*0.01`, expectedOverage, { fill: fill(YELLOW_BG) })
    setFormula(ws, row, 3, `F${stockRow}-(B${stockRow}+C${stockRow}-G${stockRow})-(D${fuelRow}+H${fuelRow})`, actualOverage, { fill: fill(YELLOW_BG) })
    setFormula(ws, row, 4, `C${row}-B${row}`, variance, { fill: fill(YELLOW_BG) })
    // E:K merged comments — matches reference formula on every sheet
    const cmtMsg = variance > 0
      ? 'Liquid height variation on the Positive side'
      : 'Liquid height variation on the Negative side'
    const cmtCell = ws.getCell(row, 5)
    cmtCell.value = {
      formula: `IF(D${row}>0, "Liquid height variation on the Positive side", "Liquid height variation on the Negative side")`,
      result: cmtMsg,
    }
    applyStyle(cmtCell, {
      font: FONT,
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: { top: thin(), bottom: thin(), left: thin(), right: thick() },
    })
    for (let c = 6; c <= 11; c++) {
      setCell(ws, row, c, '', { border: { top: thin(), bottom: thin(), right: c === 11 ? thick() : undefined } })
    }
    ws.mergeCells(row, 5, row, 11)
  }

  // ─── R19: blank merged — col A anchor gets section blue ─────────────
  for (let c = 1; c <= 11; c++) {
    setCell(ws, 19, c, '', {
      fill: fill(SECTION_BG),
      border: { left: c === 1 ? thick() : undefined, right: c === 11 ? thick() : undefined },
    })
  }
  ws.mergeCells(19, 1, 19, 11)

  // ─── R20: deposit + POS headers (col A green) ───────────────────────
  ws.getRow(20).height = HEADER_ROW_HEIGHT
  setCell(ws, 20, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  const bankHeaders = ['Deposit 1', 'Deposit 2', 'Deposit 3', 'Deposit 4',
                       'Bank POS 1', 'Bank POS 2', 'Bank POS 3', 'Bank POS 4', 'Bank POS 5', 'Bank POS 6']
  bankHeaders.forEach((h, i) => {
    const col = 2 + i
    setCell(ws, 20, col, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, col === 11),
      numFmt: NUM_FMT,
    })
  })

  // ─── R21: amounts ───────────────────────────────────────────────────
  const deposits = sheet.bankRows.deposits
  const pos = sheet.bankRows.pos
  setCell(ws, 21, 1, 'Amount (₦)', {
    font: FONT_BOLD, fill: fill(FUEL_BG),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: { left: thick(), top: med(), bottom: med(), right: thin() },
  })
  for (let i = 0; i < 4; i++) {
    setNum(ws, 21, 2 + i, deposits[i]?.amount, {
      border: { top: med(), bottom: med(), left: thin(), right: thin() },
    })
  }
  for (let i = 0; i < 6; i++) {
    const col = 6 + i
    setNum(ws, 21, col, pos[i]?.amount, {
      border: { top: med(), bottom: med(), left: thin(), right: col === 11 ? thick() : thin() },
    })
  }

  // ─── R22: bank names ────────────────────────────────────────────────
  setCell(ws, 22, 1, 'Bank', {
    font: FONT_BOLD, fill: fill(FUEL_BG),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
  })
  for (let i = 0; i < 4; i++) {
    setCell(ws, 22, 2 + i, deposits[i]?.bankName || '', {
      font: FONT, border: { top: thin(), bottom: thin(), left: thin(), right: thin() },
    })
  }
  for (let i = 0; i < 6; i++) {
    const col = 6 + i
    setCell(ws, 22, col, pos[i]?.bankName || '', {
      font: FONT, border: { top: thin(), bottom: thin(), left: thin(), right: col === 11 ? thick() : thin() },
    })
  }

  // ─── R23: CASH RECONCILIATION title ─────────────────────────────────
  setCell(ws, 23, 1, 'CASH RECONCILIATION (₦)', {
    font: FONT_BOLD, fill: fill(SECTION_BG),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: sectionTitleBorder(true, true),
    numFmt: NUM_FMT,
  })
  for (let c = 2; c <= 11; c++) {
    setCell(ws, 23, c, '', { fill: fill(SECTION_BG), border: { top: med(), bottom: med() } })
  }
  ws.mergeCells(23, 1, 23, 11)

  // ─── R24: cash recon headers (col A green) ──────────────────────────
  setCell(ws, 24, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  const cashHeaders = ['Total Expected Sales', 'Previous Day Cash @ Hand', 'Total Bank Deposit',
                       'Total POS & Transfer', 'Expected Cash @ Hand', 'Actual Cash @ Hand', 'Variance in Cash']
  cashHeaders.forEach((h, i) => {
    setCell(ws, 24, 2 + i, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, false),
      numFmt: NUM_FMT,
    })
  })
  setCell(ws, 24, 9, 'Reason for Cash Variance', {
    font: FONT_BOLD, fill: fill(HEADER_BG),
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: headerBorder(false, false),
  })
  setCell(ws, 24, 10, '', { fill: fill(HEADER_BG), border: { top: med(), bottom: med() } })
  setCell(ws, 24, 11, '', { fill: fill(HEADER_BG), border: { top: med(), bottom: med(), right: thick() } })
  ws.mergeCells(24, 9, 24, 11)

  // ─── R25: cash recon values ─────────────────────────────────────────
  const cash = sheet.cash
  setCell(ws, 25, 1, 'Amount (₦)', {
    font: FONT_BOLD, fill: fill(FUEL_BG),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: { left: thick(), top: med(), bottom: med(), right: thin() },
  })
  const r25Border = { top: med(), bottom: med(), left: thin(), right: thin() }
  // Yellow on the computed cells per reference (R25C2,C4,C5,C6,C8).
  // C3 (Prev Day Cash) and C7 (Actual Cash) are inputs — NO yellow.
  setFormula(ws, 25, 2, `SUM(K5:K8)`, cash.totalExpectedSales, { fill: fill(YELLOW_BG), border: r25Border })
  setNum(ws, 25, 3, cash.prevDayCash, { border: r25Border })
  // Deposits and POS & Transfer are the day's full totals, as figures: the form's rows hold only
  // four deposits and six POS, and has no row for transfers, so a sum of its cells came up short.
  setNum(ws, 25, 4, cash.totalBankDeposit, { fill: fill(YELLOW_BG), border: r25Border })
  setNum(ws, 25, 5, cash.totalPOS + cash.totalTransfer, { fill: fill(YELLOW_BG), border: r25Border })
  // Cash at hand for the day, before anything is banked: Sales + Previous - POS & Transfer.
  setFormula(ws, 25, 6, `B25+C25-E25`, cash.expectedCashAtHand, { fill: fill(YELLOW_BG), border: r25Border })
  setNum(ws, 25, 7, cash.actualCashAtHand, { border: r25Border })
  setFormula(ws, 25, 8, `G25-F25`, cash.variance, { fill: fill(YELLOW_BG), border: r25Border })
  setCell(ws, 25, 9, cash.reason || '', {
    font: FONT, alignment: { horizontal: 'left', vertical: 'middle' },
    border: { top: med(), bottom: med(), left: thin(), right: thin() },
  })
  setCell(ws, 25, 10, '', { border: { top: med(), bottom: med() } })
  setCell(ws, 25, 11, '', { border: { top: med(), bottom: med(), right: thick() } })
  ws.mergeCells(25, 9, 25, 11)

  // ─── R26: blank merged — col A anchor gets section blue ─────────────
  for (let c = 1; c <= 11; c++) {
    setCell(ws, 26, c, '', {
      fill: fill(SECTION_BG),
      border: { left: c === 1 ? thick() : undefined, right: c === 11 ? thick() : undefined },
    })
  }
  ws.mergeCells(26, 1, 26, 11)

  // ─── R27: budget headers (col A green) ──────────────────────────────
  setCell(ws, 27, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  ;['Budget (Ltrs)', 'Achievement', 'Variance (Ltrs)'].forEach((h, i) => {
    setCell(ws, 27, 2 + i, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, false),
      numFmt: NUM_FMT,
    })
  })
  setCell(ws, 27, 5, 'Comments on Sales Achievement (Issues that Increased or Reduced Sales on this Date)', {
    font: FONT_BOLD, fill: fill(HEADER_BG),
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: headerBorder(false, false),
  })
  for (let c = 6; c <= 11; c++) {
    setCell(ws, 27, c, '', { fill: fill(HEADER_BG), border: { top: med(), bottom: med(), right: c === 11 ? thick() : undefined } })
  }
  ws.mergeCells(27, 5, 27, 11)

  // ─── R28–R30: budget rows (budget a placeholder; variance from the stock) ─
  const BUDGET_PLACEHOLDER = { PMS: 14400, AGO: 480, DPK: 240 }
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = BUDGET_ROWS[ft]
    const fuelRow = FUEL_ROWS[ft]
    const budget = BUDGET_PLACEHOLDER[ft]
    setCell(ws, row, 1, ft, {
      font: FONT, fill: fill(FUEL_BG),
      border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
    })
    setNum(ws, row, 2, budget, { border: { top: thin(), bottom: thin(), left: thin(), right: thin() } })
    setFormula(ws, row, 3, `J${fuelRow}/B${row}`, 0, {
      numFmt: '0.0%',
      fill: fill(YELLOW_BG),
      border: { top: thin(), bottom: thin(), left: thin(), right: thin() },
    })
    // Variance is calculated from the stock: actual overage less expected overage, the stock
    // reconciliation row's own Variance cell (R16-R18), not sales less the budget.
    const s = stockByType[ft] || {}
    const f = fuelByType[ft] || {}
    const fell = (s.opening || 0) + (s.waybill || 0) - (s.closing || 0)
    const stockVariance = ((s.totalDispensed || 0) - fell - ((f.rttP1 || 0) + (f.rttP2 || 0))) - fell * 0.01
    setFormula(ws, row, 4, `D${RECON_ROWS[ft]}`, stockVariance, {
      fill: fill(YELLOW_BG),
      border: { top: thin(), bottom: thin(), left: thin(), right: thin() },
    })
    const cmtCell = ws.getCell(row, 5)
    cmtCell.value = { formula: `IF(D${row}<0, "Low Demand", "High Demand")`, result: stockVariance < 0 ? 'Low Demand' : 'High Demand' }
    applyStyle(cmtCell, {
      font: FONT,
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: thin(), bottom: thin(), left: thin(), right: thick() },
    })
    for (let c = 6; c <= 11; c++) {
      setCell(ws, row, c, '', { border: { top: thin(), bottom: thin(), right: c === 11 ? thick() : undefined } })
    }
    ws.mergeCells(row, 5, row, 11)
  }

  // ─── R31: LUBES budget ──────────────────────────────────────────────
  setCell(ws, 31, 1, 'LUBES', {
    font: FONT, fill: fill(FUEL_BG),
    border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
  })
  setNum(ws, 31, 2, 0, { border: { top: thin(), bottom: thin(), left: thin(), right: thin() } })
  setNum(ws, 31, 3, 0, { fill: fill(YELLOW_BG), border: { top: thin(), bottom: thin(), left: thin(), right: thin() } })
  setNum(ws, 31, 4, 0, { fill: fill(YELLOW_BG), border: { top: thin(), bottom: thin(), left: thin(), right: thin() } })
  setCell(ws, 31, 5, '', { border: { top: thin(), bottom: thin(), left: thin(), right: thick() } })
  for (let c = 6; c <= 11; c++) {
    setCell(ws, 31, c, '', { border: { top: thin(), bottom: thin(), right: c === 11 ? thick() : undefined } })
  }
  ws.mergeCells(31, 5, 31, 11)

  // ─── R32: blank merged — col A anchor gets section blue ─────────────
  for (let c = 1; c <= 11; c++) {
    setCell(ws, 32, c, '', {
      fill: fill(SECTION_BG),
      border: { left: c === 1 ? thick() : undefined, right: c === 11 ? thick() : undefined },
    })
  }
  ws.mergeCells(32, 1, 32, 11)

  // ─── R33: competitor headers (col A green) ──────────────────────────
  setCell(ws, 33, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  const compHeaders = ['Rainoil', 'Competitor 1', 'Price 1', 'Competitor 2', 'Price 2', 'Competitor 3', 'Price 3', 'Competitor 4', 'Price 4']
  compHeaders.forEach((h, i) => {
    setCell(ws, 33, 2 + i, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, false),
      numFmt: NUM_FMT,
    })
  })
  setCell(ws, 33, 11, '', { fill: fill(HEADER_BG), border: headerBorder(false, true) })

  // ─── R34–R36: competitor rows (placeholder values) ──────────────────
  const COMP_PLACEHOLDER = {
    PMS: { rainoil: 537, c1: 'PRIME',  p1: 6,     c2: 'NNPC', p2: 511, c3: 'YOZIDDA', p3: 511, c4: 'NASKO', p4: 505 },
    AGO: { rainoil: 650, c1: 'Conoil', p1: 650,   c2: 'NNPC', p2: 670, c3: 'YOZIDDA', p3: 680, c4: 'NASKO', p4: 680 },
    DPK: { rainoil: 700, c1: 'PRIME',  p1: 'NIL', c2: 'NNPC', p2: 0,   c3: 'YOZZIDA', p3: 0,   c4: 'NASKO', p4: 'NIL' },
  }
  for (const ft of ['PMS', 'AGO', 'DPK']) {
    const row = COMP_ROWS[ft]
    const c = COMP_PLACEHOLDER[ft]
    setCell(ws, row, 1, ft, {
      font: FONT, fill: fill(FUEL_BG),
      border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
    })
    const bdr = { top: thin(), bottom: thin(), left: thin(), right: thin() }
    setNum(ws, row, 2, c.rainoil, { border: bdr })
    setCell(ws, row, 3, c.c1, { font: FONT, border: bdr })
    typeof c.p1 === 'number'
      ? setNum(ws, row, 4, c.p1, { border: bdr })
      : setCell(ws, row, 4, c.p1, { font: FONT, border: bdr })
    setCell(ws, row, 5, c.c2, { font: FONT, border: bdr })
    setNum(ws, row, 6, c.p2, { border: bdr })
    setCell(ws, row, 7, c.c3, { font: FONT, border: bdr })
    setNum(ws, row, 8, c.p3, { border: bdr })
    setCell(ws, row, 9, c.c4, { font: FONT, border: bdr })
    typeof c.p4 === 'number'
      ? setNum(ws, row, 10, c.p4, { border: bdr })
      : setCell(ws, row, 10, c.p4, { font: FONT, border: bdr })
    setCell(ws, row, 11, '', { border: { top: thin(), bottom: thin(), right: thick() } })
  }

  // ─── R37: LUBE BREAKDOWN title ──────────────────────────────────────
  setCell(ws, 37, 1, 'LUBE SALES BREAKDOWN', {
    font: FONT_BOLD, fill: fill(SECTION_BG),
    alignment: { horizontal: 'left', vertical: 'middle' },
    border: sectionTitleBorder(true, true),
    numFmt: NUM_FMT,
  })
  for (let c = 2; c <= 11; c++) {
    setCell(ws, 37, c, '', { fill: fill(SECTION_BG), border: { top: med(), bottom: med() } })
  }
  ws.mergeCells(37, 1, 37, 11)

  // ─── R38: lube headers (col A green) ────────────────────────────────
  setCell(ws, 38, 1, '', { fill: fill(FUEL_BG), border: headerBorder(true, false) })
  setCell(ws, 38, 2, '', { fill: fill(HEADER_BG), border: headerBorder(false, false) })
  ;['Litre', 'Unit Price', 'Opening Stock Units', 'Product Supply Units', 'Sales Units', 'Closing Stock Units', 'Amount (₦)', 'Variance Units'].forEach((h, i) => {
    setCell(ws, 38, 3 + i, h, {
      font: FONT_BOLD, fill: fill(HEADER_BG),
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder(false, false),
      numFmt: NUM_FMT,
    })
  })
  setCell(ws, 38, 11, '', { fill: fill(HEADER_BG), border: headerBorder(false, true) })

  // ─── R39+: lube product rows ────────────────────────────────────────
  const firstLubeRow = 39
  const lubeItems = sheet.lube || []
  let row = firstLubeRow
  for (const item of lubeItems) {
    setCell(ws, row, 1, item.productName, {
      font: FONT, alignment: { horizontal: 'left', vertical: 'middle' },
      border: { left: thick(), top: thin(), bottom: thin(), right: thin() },
    })
    setCell(ws, row, 2, '', {
      border: { top: thin(), bottom: thin(), left: thin(), right: thin() },
    })
    ws.mergeCells(row, 1, row, 2) // A{row}:B{row}
    const bdr = { top: thin(), bottom: thin(), left: thin(), right: thin() }
    const bdrY = { ...bdr }
    setNum(ws, row, 3, item.litre,         { border: bdr })
    setNum(ws, row, 4, item.unitPrice,     { border: bdr })
    setNum(ws, row, 5, item.openingStock,  { border: bdr })
    setNum(ws, row, 6, item.productSupply, { border: bdr })
    setFormula(ws, row, 7, `E${row}+F${row}-H${row}`, item.sales || 0, { fill: fill(YELLOW_BG), border: bdrY })
    setNum(ws, row, 8, item.closingStock,  { border: bdr })
    setFormula(ws, row, 9, `G${row}*D${row}`, item.amount || 0, { fill: fill(YELLOW_BG), border: bdrY })
    setFormula(ws, row, 10, `G${row}+H${row}-E${row}-F${row}`, item.variance || 0, { fill: fill(YELLOW_BG), border: bdrY })
    setCell(ws, row, 11, '', { border: { top: thin(), bottom: thin(), right: thick() } })
    row++
  }

  // TOTAL row
  if (lubeItems.length > 0) {
    const totalRow = row
    const lastRow = totalRow - 1
    const sums = lubeItems.reduce((a, i) => ({
      opening: a.opening + (i.openingStock || 0),
      supply:  a.supply  + (i.productSupply || 0),
      sales:   a.sales   + (i.sales || 0),
      closing: a.closing + (i.closingStock || 0),
      amount:  a.amount  + (i.amount || 0),
      variance:a.variance+ (i.variance || 0),
    }), { opening: 0, supply: 0, sales: 0, closing: 0, amount: 0, variance: 0 })

    // Reference has YELLOW fill across the entire TOTAL row (label + sums + trailing).
    setCell(ws, totalRow, 1, 'TOTAL', {
      font: FONT_BOLD, fill: fill(YELLOW_BG),
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: { left: thick(), top: thin(), bottom: med(), right: thin() },
    })
    setCell(ws, totalRow, 2, '', {
      fill: fill(YELLOW_BG),
      border: { top: thin(), bottom: med(), left: thin(), right: thin() },
    })
    ws.mergeCells(totalRow, 1, totalRow, 2)
    setCell(ws, totalRow, 3, '', { fill: fill(YELLOW_BG), border: { top: thin(), bottom: med() } })
    setCell(ws, totalRow, 4, '', { fill: fill(YELLOW_BG), border: { top: thin(), bottom: med() } })
    const totBdr = { top: thin(), bottom: med(), left: thin(), right: thin() }
    // Reference's TOTAL row formula skips the first product row (starts at row 40).
    // Preserve the quirk so the export looks like a manually-edited file.
    const sumStart = firstLubeRow + 1
    setFormula(ws, totalRow, 5,  `SUM(E${sumStart}:E${lastRow})`, sums.opening,  { fill: fill(YELLOW_BG), border: totBdr })
    setFormula(ws, totalRow, 6,  `SUM(F${sumStart}:F${lastRow})`, sums.supply,   { fill: fill(YELLOW_BG), border: totBdr })
    setFormula(ws, totalRow, 7,  `SUM(G${sumStart}:G${lastRow})`, sums.sales,    { fill: fill(YELLOW_BG), border: totBdr })
    setFormula(ws, totalRow, 8,  `SUM(H${sumStart}:H${lastRow})`, sums.closing,  { fill: fill(YELLOW_BG), border: totBdr })
    setFormula(ws, totalRow, 9,  `SUM(I${sumStart}:I${lastRow})`, sums.amount,   { fill: fill(YELLOW_BG), border: totBdr })
    setFormula(ws, totalRow, 10, `SUM(J${sumStart}:J${lastRow})`, sums.variance, { fill: fill(YELLOW_BG), border: totBdr })
    setCell(ws, totalRow, 11, '', { fill: fill(YELLOW_BG), border: { top: thin(), bottom: med(), right: thick() } })

    // Wire R8 K8 (LUBES amount) to lube total
    setFormula(ws, 8, 11, `I${totalRow}`, sums.amount, {
      fill: fill(YELLOW_BG),
      border: { top: thin(), bottom: thin(), left: thin(), right: thick() },
    })
  } else {
    setCell(ws, 8, 11, '', {
      fill: fill(YELLOW_BG),
      border: { top: thin(), bottom: thin(), left: thin(), right: thick() },
    })
  }
}

function safeSheetName(name) {
  return String(name).replace(/[\\/?*[\]:]/g, '_').slice(0, 31)
}

function buildFilename(stationName) {
  const station = (stationName || 'Station').replace(/[\\/?*[\]:]/g, '').trim()
  return `${station} Sales Operation.xlsx`
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportSalesOperationExcel({ report, stationName, startDate, endDate }) {
  if (!report || !report.sheets?.length) return

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Station Portal'
  wb.created = new Date()

  for (const sheet of report.sheets) {
    const ws = wb.addWorksheet(safeSheetName(sheet.sheetName))
    buildSheet(ws, sheet, stationName)
    unlockInputCells(ws)
    // Sheet protection without password — formula cells become read-only,
    // input (yellow + non-yellow) cells stay editable.
    await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, buildFilename(stationName))
}
