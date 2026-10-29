'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight } from 'lucide-react'
import { db } from '@/lib/db'
import { buildDailyReport } from '@/lib/buildDailyReport'
import { lubeOnAccount } from '@/lib/accountBalance'
import DateRange from '@/components/reports/DateRange'
import DayNav, { DayTitle } from '@/components/reports/DayNav'
import AccessGate from '@/components/AccessGate'
import BalancesSheet from '@/components/reports/BalancesSheet'
import AgoSheet from '@/components/reports/AgoSheet'
import { REPORT_HEAD, REPORT_SUBHEAD, REPORT_LINE, REPORT_TOTAL_FILL, OUTLINE_WITHIN, BTN_PRIMARY, REPORT_CARD } from '@/components/ui'
import { ReportSkeleton, ReportTablesSkeleton } from '@/components/Skeletons'

// Lodgements: POS, then transfer, then deposit, then anything else, A to Z within each.
const LODGEMENT_ORDER = { pos: 0, transfer: 1, bank_deposit: 2 }
const byLodgementType = (a, b) => (LODGEMENT_ORDER[a.lodgementType] ?? 9) - (LODGEMENT_ORDER[b.lodgementType] ?? 9)
  || String(a.bankName || '').localeCompare(String(b.bankName || ''))

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SummaryPage() {
  return (
    <Suspense fallback={<ReportSkeleton />}>
      <SummaryContent />
    </Suspense>
  )
}

function SummaryContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

  const [startDate, _setStartDate] = useState(monthStartStr)
  const [endDate, _setEndDate] = useState(todayStr)
  const startDateRef = useRef(monthStartStr)
  const endDateRef = useRef(todayStr)
  const setStartDate = (v) => { startDateRef.current = v; _setStartDate(v) }
  const setEndDate = (v) => { endDateRef.current = v; _setEndDate(v) }
  const [viewDate, setViewDate] = useState(todayStr)
  const [generated, setGenerated] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  const [balancesOpen, setBalancesOpen] = useState(false)
  const [agoOpen, setAgoOpen] = useState(false)
  // Five taps on the date, each within a second and a half of the last, open the AGO sheet.
  const taps = useRef({ n: 0, at: 0 })
  const tapDate = () => {
    const now = Date.now()
    taps.current = { n: now - taps.current.at < 1500 ? taps.current.n + 1 : 1, at: now }
    if (taps.current.n >= 5) { taps.current = { n: 0, at: 0 }; setAgoOpen(true) }
  }

  // Config
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      const [noz, tnk, bnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
      ])
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setNozzles(noz)
      setTanks(tnk)
      setBanks(bnk)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  // Live queries
  const liveSales = useLiveQuery(
    () => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLodgements = useLiveQuery(
    () => orgId ? db.lodgements.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveCustomers = useLiveQuery(
    () => orgId ? db.customers.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  // The accounts' own entries, with their lube sales on credit, for the balances (as the daily
  // sales report does).
  const livePayments = useLiveQuery(
    async () => orgId
      ? [
          ...await db.customerPayments.where('orgId').equals(orgId).toArray(),
          ...lubeOnAccount(await db.lubeSales.where('orgId').equals(orgId).toArray(), await db.lubeProducts.where('orgId').equals(orgId).toArray()),
        ]
      : [],
    [orgId]
  )

  const customerMap = useMemo(() => {
    if (!liveCustomers) return {}
    return Object.fromEntries(liveCustomers.map(c => [c.id, c.name || 'Unknown']))
  }, [liveCustomers])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts || !liveLodgements) return null
    return buildDailyReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: liveLodgements,
      nozzles,
      tanks,
      banks,
      customers: liveCustomers || [],
      customerPayments: livePayments || [],
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, banks, liveSales, liveReceipts, liveLodgements, liveCustomers, livePayments])

  // Current day index and report
  const dayIndex = useMemo(() => {
    if (!report?.dateReports?.length) return -1
    const idx = report.dateReports.findIndex(r => r.date === viewDate)
    return idx >= 0 ? idx : report.dateReports.length - 1
  }, [report, viewDate])

  const dayReport = report?.dateReports?.[dayIndex] || null
  const totalDays = report?.dateReports?.length || 0

  const goPrev = () => {
    if (!report?.dateReports || dayIndex <= 0) return
    setViewDate(report.dateReports[dayIndex - 1].date)
  }
  const goNext = () => {
    if (!report?.dateReports || dayIndex >= totalDays - 1) return
    setViewDate(report.dateReports[dayIndex + 1].date)
  }

  // Clamp viewDate when range changes
  useEffect(() => {
    if (!reportStart || !reportEnd) return
    if (viewDate < reportStart || viewDate > reportEnd) setViewDate(reportEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStart, reportEnd])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    setGenerating(true)
    setTimeout(() => {
      setReportStart(s)
      setReportEnd(e)
      setGenerated(true)
      setGenerating(false)
    }, 2000)
  }

  if (loading) {
    return <ReportSkeleton />
  }

  if (!orgId) {
    return <div className="max-w-4xl px-4 sm:px-8 py-8"><p className="text-base text-content-muted">No station selected.</p></div>
  }

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-1 py-0.5`
  const cellR = `${cell} text-right`

  return (
    <AccessGate orgId={orgId} pageKey="report-summary">
      {({ isOwner }) => (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-2 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-end py-3 shrink-0">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateRange
            start={startDate}
            end={endDate}
            onStart={setStartDate}
            onEnd={setEndDate}
            onGenerate={handleGenerate}
            generating={generating}
            disabled={!startDate || !endDate || startDate > endDate}
          />
        </div>
      </div>

      {/* Content */}
      {!generated ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-content-faint text-sm">Select a date range and click Load.</p>
        </div>
      ) : !report ? (
        <div className="flex-1 min-h-0 overflow-hidden"><ReportTablesSkeleton /></div>
      ) : !dayReport ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-content-faint text-sm">No data for this period.</p>
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 px-1 sm:px-[15%] ${REPORT_CARD}`}>
          {/* The day, at the top of its tables (five taps: the AGO sheet); Prev / Next are under them. */}
          <DayTitle date={dayReport.date} onClick={tapDate} />

          {/* 1. Closing Meter Readings per entry */}
          {dayReport.entryGroups.map((group, groupIdx) => (
            <div key={group.entryIndex} className="mb-4">
              {dayReport.entryCount > 1 && (
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    <tr className={hdr}>
                      <td className={cell} colSpan={4}>Entry {group.entryIndex}</td>
                    </tr>
                  </tbody>
                </table>
              )}

              {/* Closing readings grouped by fuel */}
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {report.fuelTypes.map(ft => {
                    const fuelGroup = group.nozzleRows.find(nr => nr.fuelType === ft)
                    if (!fuelGroup) return null
                    const isLastGroup = groupIdx === dayReport.entryGroups.length - 1
                    return (
                      <ClosingReadings
                        key={ft}
                        fuelType={ft}
                        rows={fuelGroup.rows}
                        totals={fuelGroup.totals}
                        dayTotals={isLastGroup ? dayReport.dayFuelTotals[ft] : null}
                        cell={cell}
                        cellR={cellR}
                        subHdr={subHdr}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* 2. Consumption tables (split: cons + pour back) */}
          {(() => {
            const consEntries = dayReport.consumption.entries.filter(e => !e.isPourBack)
            const pbEntries = dayReport.consumption.entries.filter(e => e.isPourBack)
            return (
              <>
                {consEntries.length > 0 && (
                  <table className="w-full border-collapse text-sm mb-4">
                    <thead>
                      <tr className={subHdr}>
                        <th className={`${cell} text-left font-bold`} colSpan={3}>Consumption</th>
                      </tr>
                      <tr className={subHdr}>
                        <th className={`${cell} text-left font-bold`}>Account</th>
                        <th className={`${cell} text-left font-bold`}>Fuel</th>
                        <th className={`${cellR} font-bold`}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consEntries.map((c, i) => (
                        <tr key={i}>
                          <td className={cell}>{customerMap[c.customerId] || 'Unknown'}</td>
                          <td className={cell}>{c.fuelType || ''}</td>
                          <td className={cellR}>{fmt(c.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {pbEntries.length > 0 && (
                  <table className="w-full border-collapse text-sm mb-4">
                    <thead>
                      <tr className={subHdr}>
                        <th className={`${cell} text-left font-bold`} colSpan={3}>Pour Back</th>
                      </tr>
                      <tr className={subHdr}>
                        <th className={`${cell} text-left font-bold`}>Account</th>
                        <th className={`${cell} text-left font-bold`}>Fuel</th>
                        <th className={`${cellR} font-bold`}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pbEntries.map((c, i) => (
                        <tr key={i}>
                          <td className={cell}>{customerMap[c.customerId] || 'Unknown'}</td>
                          <td className={cell}>{c.fuelType || ''}</td>
                          <td className={cellR}>{fmt(c.quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )
          })()}

          {/* 3. Lodgements */}
          <table className="w-full border-collapse text-sm mb-4">
            <thead>
              <tr className={subHdr}>
                <th className={`${cell} text-left font-bold`}>Lodgements</th>
                <th className={`${cellR} font-bold`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* Every account, nothing lodged as 0: POS, transfer, deposit, A to Z within each. */}
              {[...dayReport.lodgement.bankRows].sort(byLodgementType).map(row => (
                <tr key={row.bankId}>
                  <td className={cell}>
                    <span className="font-bold">{row.bankName}{row.terminalId ? ` - ${row.terminalId}` : ''}</span>
                    <span className="text-xs text-content-faint ml-1">({row.lodgementType === 'bank_deposit' ? 'deposit' : row.lodgementType})</span>
                  </td>
                  <td className={cellR}>{fmt(row.deposited)}</td>
                </tr>
              ))}
              {dayReport.lodgement.bankRows.length === 0 && (
                <tr><td colSpan={2} className={`${cell} text-content-faint`}>No lodgements</td></tr>
              )}
              {dayReport.lodgement.bankRows.length > 0 && (
                <tr className={`${subHdr} font-bold`}>
                  <td className={cell}>Total Lodged</td>
                  <td className={cellR}>{fmt(dayReport.lodgement.totalAll)}</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Credit customers' balances at the end of the day, the ones not at zero: a full-width
              card with the totals; the customers are in a bottom sheet (BalancesSheet). */}
          {dayReport.balances.rows.length > 0 && (
            <button
              type="button"
              onClick={() => setBalancesOpen(true)}
              className={`w-full mb-4 flex items-center gap-3 px-3 py-3 text-left ${REPORT_TOTAL_FILL} border ${REPORT_LINE}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">Balances · {dayReport.balances.rows.length} account{dayReport.balances.rows.length === 1 ? '' : 's'}</p>
                <p className="text-xs mt-0.5">Owes station {fmt(dayReport.balances.totalOwesStation)} · Station owes {fmt(dayReport.balances.totalStationOwes)}</p>
              </div>
              <ChevronRight className="w-5 h-5 flex-shrink-0" />
            </button>
          )}

          {/* 4. Product Received */}
          {report.fuelTypes.some(ft => (dayReport.tanksByFuel?.[ft]?.totalSupply || 0) > 0) && (
            <table className="w-full border-collapse text-sm mb-4">
              <thead>
                <tr className={subHdr}>
                  <th className={`${cell} text-left font-bold`}>Product Received</th>
                  <th className={`${cellR} font-bold`}>Volume</th>
                </tr>
              </thead>
              <tbody>
                {report.fuelTypes.map(ft => {
                  const supply = dayReport.tanksByFuel?.[ft]?.totalSupply || 0
                  if (!supply) return null
                  return (
                    <tr key={ft}>
                      <td className={`${cell} font-bold`}>{ft}</td>
                      <td className={cellR}>{fmt(supply)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* 5. The day's totals (each fuel's sales, price and amount are in its meter table). */}
          <table className="w-full border-collapse text-sm mb-4">
            <tbody>
              <tr className={`${subHdr} font-bold`}>
                <td className={cell}>SALES</td>
                <td className={cellR}>{fmt(dayReport.totalSales)}</td>
              </tr>
              <tr className="font-bold">
                <td className={cell}>TOTAL POS</td>
                <td className={cellR}>{fmt(dayReport.lodgement.totalPOS)}</td>
              </tr>
              <tr className="font-bold">
                <td className={cell}>TOTAL TRANSFER</td>
                <td className={cellR}>{fmt(dayReport.lodgement.totalTransfer)}</td>
              </tr>
              <tr className={`${subHdr} font-bold`}>
                <td className={cell}>CASH</td>
                <td className={cellR}>{fmt(dayReport.cashBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Day navigation, under the day's tables */}
      {report && <DayNav index={dayIndex} total={totalDays} onPrev={goPrev} onNext={goNext} />}

      {dayReport && <BalancesSheet open={balancesOpen} onClose={() => setBalancesOpen(false)} balances={dayReport.balances} orgId={orgId} date={dayReport.date} />}
      <AgoSheet open={agoOpen} onClose={() => setAgoOpen(false)} orgId={orgId} sales={liveSales} />
    </div>
      )}
    </AccessGate>
  )
}

/** A price as typed: whole naira, or with its kobo when it has some. */
const fmtPrice = (n) => Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Renders closing meter readings for one fuel type: dispensed − consumption = sales @ price (amount) */
function ClosingReadings({ fuelType, rows, totals, dayTotals, cell, cellR, subHdr }) {
  // Use day-level totals from consumption_entries when available (last entry group)
  const src = dayTotals || totals
  const dispensed = src.dispensed
  const consumed = src.consumed || 0
  const pourBack = src.pourBack || 0
  const adjustment = consumed + pourBack
  const actual = src.actual

  return (
    <>
      {/* Each nozzle: its opening and closing meter, and what it dispensed between them. */}
      <tr className={subHdr}>
        <td className={`${cell} font-bold`}>{fuelType}</td>
        <td className={`${cellR} font-bold`}>Opening</td>
        <td className={`${cellR} font-bold`}>Closing</td>
        <td className={`${cellR} font-bold`}>Dispensed</td>
      </tr>
      {rows.map((r, i) => (
        <tr key={r.label}>
          <td className={`${cell} font-bold`}>{fuelType} {i + 1}</td>
          <td className={cellR}>{fmt(r.opening)}</td>
          <td className={cellR}>{fmt(r.closing)}</td>
          <td className={cellR}>{fmt(r.dispensed)}</td>
        </tr>
      ))}
      {dayTotals ? (
        <tr className={`${REPORT_TOTAL_FILL} font-bold`}>
          <td className={cell} colSpan={4}>
            {fmt(dispensed)} &minus; {fmt(adjustment)} = {fmt(actual)} @{fmtPrice(dayTotals.price)} ({fmt(dayTotals.amount)})
          </td>
        </tr>
      ) : (
        <tr className={`${REPORT_TOTAL_FILL} font-bold`}>
          <td className={cell} colSpan={4}>
            Dispensed: {fmt(totals.dispensed)}
          </td>
        </tr>
      )}
    </>
  )
}
