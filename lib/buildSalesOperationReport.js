/**
 * Build the "Sales Operation" report from raw IndexedDB data + config.
 *
 * Mirrors the Lucky Way Station Daily Sales Report (August 2023) Excel template:
 *   - One sheet per date, named DD.MM (e.g. 01.08)
 *   - Sheet handles up to 2 unique prices per fuel type (Price 1 + Price 2)
 *   - If a date has 3+ unique price signatures, split into additional sheets
 *     named "DD.MM (2)", "DD.MM (3)", ... Each split sheet behaves as if the
 *     previous sheet were the "previous day".
 *
 * Pure function — no side effects. All inputs in camelCase.
 *
 * @param {Object} params
 * @param {Array}  params.sales         - dailySales entries
 * @param {Array}  params.receipts      - productReceipts entries
 * @param {Array}  params.lodgements    - lodgement entries
 * @param {Array}  params.lubeSales     - lubeSales entries
 * @param {Array}  params.lubeProducts  - lubeProducts config
 * @param {Array}  params.nozzles       - Nozzle config
 * @param {Array}  params.tanks         - Tank config
 * @param {Array}  params.banks         - Bank config
 * @param {string} params.startDate     - YYYY-MM-DD
 * @param {string} params.endDate       - YYYY-MM-DD
 * @returns {{ sheets: Array, fuelTypes: Array }|null}
 */

import { sortEntries, calculateEntryNozzles } from './salesCalculations'
import { calculateDateRangeLodgements } from './lodgementCalculations'
import { calculateDateRangeReceipts } from './receiptCalculations'

const FUEL_ORDER = ['PMS', 'AGO', 'DPK']
const MAX_DEPOSITS = 4
const MAX_POS = 6

function getFuelTypes(nozzles) {
  return FUEL_ORDER.filter(ft => nozzles.some(n => n.fuel_type === ft))
}

function pad2(n) { return String(n).padStart(2, '0') }

function getDateRange(startDate, endDate) {
  const dates = []
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  while (d <= end) {
    dates.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function sheetLabelFromDate(dateStr) {
  const [, m, d] = dateStr.split('-')
  return `${d}.${m}`
}

function priceSig(entry, fuelTypes) {
  return fuelTypes.map(ft => `${ft}:${Number(entry.prices?.[ft] || 0)}`).join('|')
}

// Group a date's entries into ordered unique price signatures.
// Then pair them into "shifts" of up to 2 signatures (= 1 sheet).
function buildShiftsForDate(dateEntries, fuelTypes) {
  const seen = new Map()
  const order = []
  for (const e of dateEntries) {
    const sig = priceSig(e, fuelTypes)
    if (!seen.has(sig)) {
      const prices = {}
      for (const ft of fuelTypes) prices[ft] = Number(e.prices?.[ft] || 0)
      const obj = { sig, prices, entries: [] }
      seen.set(sig, obj)
      order.push(obj)
    }
    seen.get(sig).entries.push(e)
  }

  const shifts = []
  for (let i = 0; i < order.length; i += 2) {
    shifts.push({ sigA: order[i], sigB: order[i + 1] || null })
  }
  if (shifts.length === 0) shifts.push({ sigA: null, sigB: null })
  return shifts
}

export function buildSalesOperationReport({
  sales = [], receipts = [], lodgements = [],
  lubeSales = [], lubeProducts = [],
  nozzles = [], tanks = [], banks = [],
  startDate, endDate,
}) {
  if (!nozzles.length) return null

  const fuelTypes = getFuelTypes(nozzles)
  const sortedSales = sortEntries(sales)

  // Pre-compute receipts indexed by date
  const receiptResult = calculateDateRangeReceipts(receipts, tanks, startDate, endDate)
  const receiptByDate = {}
  for (const rd of receiptResult.dates) receiptByDate[rd.date] = rd

  // Pre-compute lodgements indexed by date (provides bankRows with totals)
  const lodgementResult = calculateDateRangeLodgements(lodgements, banks, startDate, endDate)
  const lodgementByDate = {}
  for (const ld of lodgementResult.dates) lodgementByDate[ld.date] = ld

  // Entries grouped by date
  const entriesByDate = {}
  for (const e of sortedSales) {
    const d = e.entryDate
    if (!entriesByDate[d]) entriesByDate[d] = []
    entriesByDate[d].push(e)
  }

  // Lube sales indexed by date
  const lubeByDate = {}
  for (const ls of lubeSales) {
    if (!lubeByDate[ls.entryDate]) lubeByDate[ls.entryDate] = []
    lubeByDate[ls.entryDate].push(ls)
  }

  // Nozzle → tank mapping for tank-level dispensed accumulation
  const nozzleTankMap = {}
  for (const n of nozzles) {
    if (n.tank_id) nozzleTankMap[n.id] = n.tank_id
  }

  // Last entry before range start — used to seed day 1's opening tank readings
  let prevEntry = null
  for (let i = sortedSales.length - 1; i >= 0; i--) {
    if (sortedSales[i].entryDate < startDate) { prevEntry = sortedSales[i]; break }
  }

  // Lube opening stock per product, carried forward through the range
  const lubeOpeningByProduct = {}
  for (const p of lubeProducts) {
    lubeOpeningByProduct[p.id] = Number(p.opening_stock || 0)
  }
  for (const ls of lubeSales) {
    if (ls.entryDate < startDate && lubeOpeningByProduct[ls.productId] !== undefined) {
      lubeOpeningByProduct[ls.productId] +=
        Number(ls.unitReceived || 0) - Number(ls.unitSold || 0)
    }
  }

  // Cash left over from the sheet before (after its deposits); the range's first starts at 0.
  let prevShiftCash = 0

  const dateStrings = getDateRange(startDate, endDate)
  const sheets = []

  for (const date of dateStrings) {
    const dateEntries = entriesByDate[date] || []
    const shifts = buildShiftsForDate(dateEntries, fuelTypes)
    const dayReceipt = receiptByDate[date] || { supplyByTankId: {} }
    const dayLodgement = lodgementByDate[date] || { bankRows: [] }
    const dayLubeSales = lubeByDate[date] || []

    // Day's COB (close-of-business) entry — provides authoritative closing tank readings.
    // Only the LAST shift of the day inherits the COB closing; earlier shifts carry opening
    // forward (their entries typically don't have tank readings filled in).
    const dayCobEntry = [...dateEntries].reverse().find(e => e.closeOfBusiness || e.close_of_business)

    for (let si = 0; si < shifts.length; si++) {
      const shift = shifts[si]
      const isFirstShift = si === 0
      const isLastShift = si === shifts.length - 1
      const shiftIndex = si + 1
      const sheetName = shiftIndex === 1
        ? sheetLabelFromDate(date)
        : `${sheetLabelFromDate(date)} (${shiftIndex})`

      const shiftEntries = []
      if (shift.sigA) shiftEntries.push(...shift.sigA.entries)
      if (shift.sigB) shiftEntries.push(...shift.sigB.entries)

      // Per-fuel accumulators (P1/P2 slots)
      const fuel = {}
      for (const ft of fuelTypes) {
        fuel[ft] = {
          price1: shift.sigA ? shift.sigA.prices[ft] : 0,
          actualSalesP1: 0, rttP1: 0, consP1: 0,
          price2: shift.sigB ? shift.sigB.prices[ft] : (shift.sigA ? shift.sigA.prices[ft] : 0),
          actualSalesP2: 0, rttP2: 0, consP2: 0,
          totalActualLtrs: 0, amount: 0,
        }
      }

      // Tank opening = closing of prevEntry (across shifts/days). Fallback to tank.opening_stock.
      const shiftTankOpening = {}
      const shiftTankClosing = {}
      for (const t of tanks) {
        const prevR = prevEntry?.tankReadings?.find(r => r.tank_id === t.id)
        const open = prevR ? Number(prevR.closing_stock || 0) : Number(t.opening_stock || 0)
        shiftTankOpening[t.id] = open
        shiftTankClosing[t.id] = open
      }

      const dispensedByTank = {}
      for (const t of tanks) dispensedByTank[t.id] = 0

      // Chain entries within the shift
      let chainPrev = prevEntry
      for (const e of shiftEntries) {
        const sig = priceSig(e, fuelTypes)
        const slot = shift.sigA && sig === shift.sigA.sig ? '1' : '2'

        const { fuelGroups } = calculateEntryNozzles(e, chainPrev, nozzles, tanks)
        for (const ft of fuelTypes) {
          const fg = fuelGroups[ft]
          let ftCons = 0
          let ftRtt = 0
          for (const n of fg.nozzles) {
            const r = (e.nozzleReadings || []).find(rr => rr.pump_id === n.pumpId)
            if (r) {
              ftCons += Number(r.consumption || 0)
              ftRtt += Number(r.pour_back || 0)
            }
            const tid = nozzleTankMap[n.pumpId]
            if (tid) dispensedByTank[tid] = (dispensedByTank[tid] || 0) + n.dispensed
          }
          const actual = fg.totals.dispensed - ftCons - ftRtt
          fuel[ft][`actualSalesP${slot}`] += actual
          fuel[ft][`rttP${slot}`] += ftRtt
          fuel[ft][`consP${slot}`] += ftCons
        }

        chainPrev = e
      }

      // Apply COB tank readings to LAST shift's closing only. Earlier shifts keep closing = opening.
      if (isLastShift && dayCobEntry?.tankReadings) {
        for (const r of dayCobEntry.tankReadings) {
          if (r.closing_stock != null && r.closing_stock !== '') {
            shiftTankClosing[r.tank_id] = Number(r.closing_stock)
          }
        }
      }

      // Totals + amount
      for (const ft of fuelTypes) {
        const r = fuel[ft]
        r.totalActualLtrs = r.actualSalesP1 + r.actualSalesP2
        r.amount = (r.price1 * r.actualSalesP1) + (r.price2 * r.actualSalesP2)
      }

      // What the day's trucks carried, per fuel, from the product receipts: a delivery (one truck,
      // however many tanks it filled) carried the sum of its compartments (highVol1-3); a truck
      // with more than one fuel has that split in proportion to what each fuel received. A
      // delivery entered without its compartments counts as carrying what it delivered.
      const carriedByFuel = {}
      if (isFirstShift) {
        const deliveries = {}
        for (const r of dayReceipt.receipts || []) {
          const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(p => p || '')
          const key = parts.some(Boolean) ? parts.join('|') : r.id
          if (!deliveries[key]) deliveries[key] = { first: r, records: [] }
          deliveries[key].records.push(r)
        }
        for (const { first, records } of Object.values(deliveries)) {
          const received = {}
          for (const r of records) {
            const ft = tanks.find(t => t.id === r.tankId)?.fuel_type
            if (ft) received[ft] = (received[ft] || 0) + Number(r.actualVolume || 0)
          }
          const totalReceived = Object.values(received).reduce((s, v) => s + v, 0)
          const capacity = Number(first.highVol1 || 0) + Number(first.highVol2 || 0) + Number(first.highVol3 || 0)
          for (const [ft, got] of Object.entries(received)) {
            const share = capacity > 0 && totalReceived > 0 ? capacity * got / totalReceived : got
            carriedByFuel[ft] = (carriedByFuel[ft] || 0) + share
          }
        }
      }

      // Stock per fuel type (sum across that fuel's tanks).
      // Waybill/supply only attaches to the first shift of the day.
      const stock = fuelTypes.map(ft => {
        const ftTanks = tanks.filter(t => t.fuel_type === ft)
        const opening = ftTanks.reduce((s, t) => s + (shiftTankOpening[t.id] || 0), 0)
        const closing = ftTanks.reduce((s, t) => s + (shiftTankClosing[t.id] || 0), 0)
        const supply = isFirstShift
          ? ftTanks.reduce((s, t) => s + (dayReceipt.supplyByTankId[t.id] || 0), 0)
          : 0
        const dispensed = ftTanks.reduce((s, t) => s + (dispensedByTank[t.id] || 0), 0)
        // The waybill is what the trucks carried; the truck shortage is that less what reached
        // the tanks (the product receipt's own calculation, as on the inventory log).
        const waybill = Math.round(carriedByFuel[ft] || 0)
        return {
          fuelType: ft,
          opening,
          waybill,
          actualReceived: supply,
          truckShortage: waybill - supply,
          totalDispensed: dispensed,
          closing,
        }
      })

      // Each fuel's overage, worked out once for the screen and the plain workbook: expected is
      // 1% of what left the tanks, actual is what the meters dispensed beyond that less pour
      // back, and the variance is actual less expected.
      const overage = fuelTypes.map(ft => {
        const s = stock.find(x => x.fuelType === ft)
        const fell = s.opening + s.waybill - s.closing
        const expected = fell * 0.01
        const actual = s.totalDispensed - fell - (fuel[ft].rttP1 + fuel[ft].rttP2)
        return { fuelType: ft, expected, actual, variance: actual - expected }
      })

      // Lodgements split into deposits, POS and transfers; only on first shift of a day.
      const dayDeposits = []
      const dayPOS = []
      const dayTransfers = []
      if (isFirstShift) {
        for (const row of dayLodgement.bankRows) {
          if (row.deposited > 0) {
            if (row.lodgementType === 'bank_deposit') {
              dayDeposits.push({ amount: row.deposited, bankName: row.bankName })
            } else if (row.lodgementType === 'pos') {
              dayPOS.push({ amount: row.deposited, bankName: row.bankName })
            } else if (row.lodgementType === 'transfer') {
              dayTransfers.push({ amount: row.deposited, bankName: row.bankName })
            }
          }
        }
      }
      const depositsTruncated = dayDeposits.length > MAX_DEPOSITS
      const posTruncated = dayPOS.length > MAX_POS
      const deposits = dayDeposits.slice(0, MAX_DEPOSITS)
      const pos = dayPOS.slice(0, MAX_POS)

      // Cash reconciliation
      const fuelAmount = fuelTypes.reduce((s, ft) => s + fuel[ft].amount, 0)
      const lubeAmount = isFirstShift
        ? dayLubeSales.reduce((s, ls) => s + Number(ls.unitSold || 0) * Number(ls.price || 0), 0)
        : 0
      const totalExpectedSales = fuelAmount + lubeAmount
      // Every deposit, POS and transfer counts, not only the ones the form has rows for. Cash at
      // hand is the day's cash before anything is banked: its sales and yesterday's leftover,
      // less POS and transfers. What is left after the day's deposits carries to the next day.
      const sum = (list) => list.reduce((s, d) => s + d.amount, 0)
      const totalBankDeposit = sum(dayDeposits)
      const totalPOS = sum(dayPOS)
      const totalTransfer = sum(dayTransfers)
      const expectedCashAtHand = totalExpectedSales + prevShiftCash - totalPOS - totalTransfer

      const warnings = []
      if (depositsTruncated) warnings.push(`${dayDeposits.length - MAX_DEPOSITS} additional deposit(s) not shown`)
      if (posTruncated) warnings.push(`${dayPOS.length - MAX_POS} additional POS not shown`)

      const cash = {
        totalExpectedSales,
        prevDayCash: prevShiftCash,
        totalBankDeposit,
        totalPOS,
        totalTransfer,
        expectedCashAtHand,
        actualCashAtHand: expectedCashAtHand,
        variance: 0,
        reason: warnings.join('; '),
      }

      // Lube breakdown — first shift of the day only.
      const lube = []
      if (isFirstShift && lubeProducts.length) {
        for (const product of lubeProducts) {
          const pid = product.id
          const opening = lubeOpeningByProduct[pid] || 0
          const todays = dayLubeSales.filter(ls => ls.productId === pid)
          const supply = todays.reduce((s, ls) => s + Number(ls.unitReceived || 0), 0)
          const sold = todays.reduce((s, ls) => s + Number(ls.unitSold || 0), 0)
          const closing = opening + supply - sold
          const unitPrice = todays.find(ls => ls.price)
            ? Number(todays.find(ls => ls.price).price)
            : Number(product.unit_price || 0)
          const amount = sold * unitPrice
          lubeOpeningByProduct[pid] = closing
          // Only products with something in them: an empty one (no stock, none received or sold)
          // is left off the sheet, though its stock still carries forward.
          if (!opening && !supply && !sold && !closing) continue
          lube.push({
            productName: product.product_name,
            litre: Number(product.litre || 0),
            unitPrice,
            openingStock: opening,
            productSupply: supply,
            sales: sold,
            closingStock: closing,
            amount,
            variance: 0,
          })
        }
      }

      sheets.push({
        sheetName,
        date,
        label: sheetName,
        shiftIndex,
        isFirstShift,
        times: { opening: '', closing: '' },
        fuel: fuelTypes.map(ft => ({ fuelType: ft, ...fuel[ft] })),
        stock,
        overage,
        bankRows: { deposits, pos, depositsTruncated, posTruncated },
        // Every lodgement of the day, for the screen and the plain workbook (bankRows is cut to
        // the Rainoil form's four deposit and six POS rows).
        lodgements: { deposits: dayDeposits, pos: dayPOS, transfers: dayTransfers },
        cash,
        budget: fuelTypes.map(ft => ({
          fuelType: ft, budget: null, achievement: null, variance: null, comment: '',
        })),
        competitors: fuelTypes.map(ft => ({
          fuelType: ft, rainoil: null,
          c1Name: '', c1Price: null,
          c2Name: '', c2Price: null,
          c3Name: '', c3Price: null,
          c4Name: '', c4Price: null,
        })),
        lube,
      })

      // Chain across shifts/days: the cash left once the day's deposits went to the bank.
      prevShiftCash = cash.actualCashAtHand - totalBankDeposit
      if (shiftEntries.length > 0) {
        // Last shift of the day: prefer COB entry so next day's opening comes from authoritative closing.
        prevEntry = isLastShift && dayCobEntry
          ? dayCobEntry
          : shiftEntries[shiftEntries.length - 1]
      }
    }
  }

  return { sheets, fuelTypes }
}
