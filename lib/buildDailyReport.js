import { calculateDateRangeNozzles, sortEntries, computeDayFuelTotals } from './salesCalculations'
import { calculateDateRangeLodgements } from './lodgementCalculations'
import { calculateDateRangeReceipts } from './receiptCalculations'
import { calculateDateRangeConsumption } from './consumptionCalculations'
import { isDefaultAccount } from './defaultAccounts'

/**
 * Build the complete daily sales report from raw IndexedDB data + config.
 *
 * Pure function — no side effects, no state, no DOM.
 * All inputs expected in camelCase (as stored by normalizeEntry / form saves).
 *
 * @param {Object} params
 * @param {Array}  params.sales       - All dailySales entries for the org
 * @param {Array}  params.receipts    - All productReceipts entries for the org
 * @param {Array}  params.lodgements  - All lodgement entries for the org
 * @param {Array}  params.nozzles     - Nozzle config objects
 * @param {Array}  params.tanks       - Tank config objects
 * @param {Array}  params.banks       - Bank config objects
 * @param {Array}  [params.customers]        - Customer config objects (default accounts are left out)
 * @param {Array}  [params.customerPayments] - customerPayments entries (credit sales and payments)
 * @param {string} params.startDate   - YYYY-MM-DD
 * @param {string} params.endDate     - YYYY-MM-DD
 * @returns {{ dateReports: Array, fuelTypes: Array }}
 */
export function buildDailyReport({ sales, receipts, lodgements, nozzles, tanks, banks, customers = [], customerPayments = [], startDate, endDate }) {
  if (!nozzles.length) return null

  // Credit customers, as in the Account Ledger: the default (consumption) accounts carry no balance.
  const creditCustomers = customers
    .filter(c => !isDefaultAccount(c))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  // ── 1. Nozzle + tank calculations ──
  const rangeResult = calculateDateRangeNozzles(sales, nozzles, startDate, endDate, tanks)
  const { fuelTypes } = rangeResult

  // ── 2. Lodgement calculations ──
  const lodgementResult = calculateDateRangeLodgements(lodgements, banks, startDate, endDate)
  const lodgementByDate = {}
  for (const ld of lodgementResult.dates) {
    lodgementByDate[ld.date] = ld
  }

  // ── 3. Receipt calculations ──
  const receiptResult = calculateDateRangeReceipts(receipts, tanks, startDate, endDate)
  const receiptByDate = {}
  for (const rd of receiptResult.dates) {
    receiptByDate[rd.date] = rd
  }

  // ── 3b. Consumption calculations ──
  const consumptionResult = calculateDateRangeConsumption(sales, startDate, endDate)
  const consumptionByDate = {}
  for (const cd of consumptionResult.dates) {
    consumptionByDate[cd.date] = cd
  }

  // ── 4. Sort sales for per-date matching (must match salesCalculations sort) ──
  const sorted = sortEntries(sales)

  // ── 5. Nozzle→tank mapping from config ──
  const nozzleTankMap = {}
  for (const nc of nozzles) {
    if (nc.tank_id) nozzleTankMap[nc.id] = nc.tank_id
  }

  // ── 5b. Build COB (close-of-business) tank readings by date ──
  // Tank stock uses the COB entry's readings directly (absolute values, not chained)
  // Find the last COB entry before the range for opening values on day 1
  let prevCobTankReadings = null
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].entryDate < startDate && (sorted[i].closeOfBusiness || sorted[i].close_of_business)) {
      prevCobTankReadings = sorted[i].tankReadings || []
      break
    }
  }

  // ── 6. Build per-date reports ──
  const dateReports = rangeResult.dates.map(({ date, entries: helperEntries, hasEntry, entryCount }) => {
    const dateEntries = sorted.filter(e => e.entryDate === date)

    // ── Fuel totals (shared single source of truth) ──
    const { dayFuelTotals, entryGroups: baseEntryGroups } = computeDayFuelTotals({
      helperEntries, dateEntries, fuelTypes, allSorted: sorted, date,
    })
    const dayConsumption = consumptionByDate[date] || { entries: [], byFuelType: {}, totalConsumed: 0, totalPourBack: 0 }

    // Augment entry groups with nozzle detail rows + dispensedByTankId (daily report specific)
    const dispensedByTankId = {}
    const entryGroups = baseEntryGroups.map((eg, i) => {
      const helperEntry = helperEntries[i]
      const currentEntry = dateEntries[i] || {}
      const nozzleRows = fuelTypes.map(ft => {
        const fg = helperEntry.fuelGroups[ft]
        const rows = fg.nozzles.map(n => {
          const currentR = (currentEntry.nozzleReadings || []).find(r => r.pump_id === n.pumpId)
          const consumption = currentR ? Number(currentR.consumption || 0) : 0
          const pourBack = currentR ? Number(currentR.pour_back || 0) : 0
          // In this report pour back is consumption: Cons is both, as the fuel's subtotal is.
          const consumed = consumption + pourBack
          const actual = n.dispensed - consumed
          const tid = nozzleTankMap[n.pumpId]
          if (tid) dispensedByTankId[tid] = (dispensedByTankId[tid] || 0) + n.dispensed
          return { ...n, consumption, pourBack, consumed, actual }
        })
        // The subtotal's Cons too: the shared fuelTotals keep pour back apart for other reports.
        const totals = eg.fuelTotals[ft]
        return { fuelType: ft, rows, totals: totals && { ...totals, consumed: totals.consumed + (totals.pourBack || 0) } }
      })
      return { ...eg, nozzleRows }
    })

    // ── Tanks (prefer COB entry, fall back to last entry for the date) ──
    const tanksByFuel = {}
    const dayReceipt = receiptByDate[date] || { supplyByTankId: {} }
    const supplyByTankId = dayReceipt.supplyByTankId

    // Prefer close-of-business entry; if none, use last entry for this date
    const cobEntry = [...dateEntries].reverse().find(e => e.closeOfBusiness || e.close_of_business)
    const tankEntry = cobEntry || dateEntries[dateEntries.length - 1] || null
    const cobTankReadings = tankEntry ? (tankEntry.tankReadings || []) : null

    for (const ft of fuelTypes) {
      const ftTanks = tanks.filter(t => t.fuel_type === ft).sort((a, b) => Number(a.tank_number) - Number(b.tank_number))

      const tankRows = ftTanks.map(t => {
        // Opening = previous day's COB closing, or config opening_stock
        const prevR = prevCobTankReadings ? prevCobTankReadings.find(r => r.tank_id === t.id) : null
        const opening = prevR ? Number(prevR.closing_stock || 0) : Number(t.opening_stock || 0)

        // Closing = this day's COB closing, or carry forward opening
        const cobR = cobTankReadings ? cobTankReadings.find(r => r.tank_id === t.id) : null
        const closing = cobR ? Number(cobR.closing_stock || 0) : opening

        const diff = Math.abs(closing - opening)
        const supply = supplyByTankId[t.id] || 0
        const dispensed = dispensedByTankId[t.id] || 0
        const ovsh = (closing - opening) - supply + dispensed
        return { label: `${ft} ${t.tank_number}`, tankId: t.id, opening, closing, diff, supply, dispensed, ovsh }
      })

      const totalOpening = tankRows.reduce((s, t) => s + t.opening, 0)
      const totalClosing = tankRows.reduce((s, t) => s + t.closing, 0)
      const totalSupply = tankRows.reduce((s, t) => s + t.supply, 0)
      const totalDispensed = dayFuelTotals[ft].dispensed
      const totalDiff = Math.abs(totalClosing - totalOpening)
      const totalOvsh = (totalClosing - totalOpening) - totalSupply + totalDispensed

      tanksByFuel[ft] = { tanks: tankRows, totalOpening, totalClosing, totalSupply, totalDispensed, totalDiff, totalOvsh }
    }

    // Carry forward COB readings for next date's opening
    if (cobTankReadings) prevCobTankReadings = cobTankReadings

    const tankSummaryRows = fuelTypes.map(ft => ({
      fuelType: ft,
      ...tanksByFuel[ft],
    }))

    // ── Lodgements ──
    const dayLodgement = lodgementByDate[date] || { bankRows: [], totalPOS: 0, totalTransfer: 0, totalDeposits: 0, totalCash: 0, totalOther: 0, totalAll: 0 }

    // ── Edit IDs ──
    const dateReceipts = receipts.filter(r => r.entryDate === date)
    const dateLodgements = lodgements.filter(l => (l.salesDate || l.entryDate) === date)
    const editIds = {
      receipt: dateReceipts[0]?.id || null,
      lodgement: dateLodgements[0]?.id || null,
      consumption: dayConsumption.entries[0]?.id || null,
    }

    // ── Summary ──
    const totalSales = fuelTypes.reduce((s, ft) => s + dayFuelTotals[ft].amount, 0)
    const cashBalance = totalSales - dayLodgement.totalPOS - dayLodgement.totalTransfer

    // ── Balances at the end of the day: opening balance + credit sales - payments up to it.
    // Above zero the customer owes the station; below zero the station owes the customer.
    const balanceRows = []
    for (const c of creditCustomers) {
      let balance = Number(c.opening_balance) || 0
      for (const p of customerPayments) {
        if (p.customerId !== c.id || !p.entryDate || p.entryDate > date) continue
        balance += (Number(p.salesAmount) || 0) - (Number(p.amountPaid) || 0)
      }
      if (balance === 0) continue
      balanceRows.push({
        customerId: c.id,
        name: c.name || 'Unnamed',
        owesStation: balance > 0 ? balance : 0,
        stationOwes: balance < 0 ? -balance : 0,
      })
    }
    const balances = {
      rows: balanceRows,
      totalOwesStation: balanceRows.reduce((s, r) => s + r.owesStation, 0),
      totalStationOwes: balanceRows.reduce((s, r) => s + r.stationOwes, 0),
    }

    return {
      date,
      entryGroups,
      dayFuelTotals,
      tankSummaryRows,
      tanksByFuel,
      lodgement: dayLodgement,
      consumption: dayConsumption,
      editIds,
      totalSales,
      cashBalance,
      balances,
      hasEntry,
      entryCount,
    }
  })

  return { dateReports, fuelTypes }
}
