'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from '@/lib/nav'
import Link from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Download, Pencil, X } from 'lucide-react'
import { db } from '@/lib/db'
import { buildDailyReport } from '@/lib/buildDailyReport'
import { exportDailyReportExcel } from '@/lib/exportDailyReportExcel'
import DateRange from '@/components/reports/DateRange'
import { defaultReportStart, exportAllowed } from '@/lib/reportRange'
import { tabOffsetFor } from '@/lib/dayTabs'
import { useLicence, PaidNote } from '@/components/desktop/LicenceGate'
import AccessGate from '@/components/AccessGate'
import { REPORT_HEAD, REPORT_SUBHEAD, REPORT_LINE, OUTLINE_WITHIN, BTN_FRAMED, BTN_PRIMARY, CARD_HOVER, CARD, REPORT_CARD } from '@/components/ui'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDec(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DailySalesReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <DailySalesReportContent />
    </Suspense>
  )
}

function DailySalesReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  // Desktop build: the month to date, or the last 5 days without a subscription (lib/reportRange.js).
  const monthStartStr = defaultReportStart(todayStr, `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`)
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

  // Config
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

  const [stationName, setStationName] = useState('')
  const [exporting, setExporting] = useState(false)
  // Exporting is a paid feature: without a subscription the button shows PaidNote instead.
  const paid = Boolean(useLicence()?.paid)
  const [askedToExport, setAskedToExport] = useState(false)
  const [tabOffset, setTabOffset] = useState(0)
  const [showEditModal, setShowEditModal] = useState(false)
  const TAB_COUNT = 31

  // Initial sync + config load (one-time)
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

      // Fetch station name (non-blocking, for export filename)
      fetch('/api/organizations').then(r => r.ok ? r.json() : null).then(data => {
        if (cancelled || !data) return
        const all = [...(data.stations || []), ...(data.memberStations || [])]
        const match = all.find(s => s.id === orgId)
        if (match) setStationName(match.name || '')
      }).catch(() => {})
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  // Live queries — auto-rebuild report when entries change in IndexedDB
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
  const livePayments = useLiveQuery(
    () => orgId ? db.customerPayments.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const customerMap = useMemo(() => {
    if (!liveCustomers) return {}
    return Object.fromEntries(liveCustomers.map(c => [c.id, c.name || 'Unknown']))
  }, [liveCustomers])

  // Derive report synchronously — only recalculates after Generate is clicked
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

  const handleExport = async () => {
    if (!report) return
    if (!exportAllowed()) { setAskedToExport(true); return }
    setExporting(true)
    try {
      await exportDailyReportExcel({
        report,
        customerMap,
        stationName,
        startDate: reportStart,
        endDate: reportEnd,
      })
    } finally {
      setExporting(false)
    }
  }

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

  // Clamp viewDate and reset tab offset when committed range changes
  useEffect(() => {
    if (!reportStart || !reportEnd) return
    setTabOffset(0)
    if (viewDate < reportStart) setViewDate(reportStart)
    else if (viewDate > reportEnd) setViewDate(reportEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStart, reportEnd])

  // Detect dates with duplicate COB entries (multiple COB per date causes calculation issues)
  const duplicateDates = useMemo(() => {
    if (!liveSales) return []
    const cobCountByDate = {}
    for (const e of liveSales) {
      if (!e.closeOfBusiness && !e.close_of_business) continue
      const d = e.entryDate || e.entry_date
      cobCountByDate[d] = (cobCountByDate[d] || 0) + 1
    }
    return Object.entries(cobCountByDate).filter(([, c]) => c > 1).map(([d]) => d)
  }, [liveSales])

  // Auto-scroll tabs so active day is always visible
  useEffect(() => {
    if (!report?.dateReports) return
    const idx = report.dateReports.findIndex(r => r.date === viewDate)
    setTabOffset(tabOffsetFor({ index: idx, offset: tabOffset, count: TAB_COUNT }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate, report])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="max-w-4xl px-4 sm:px-8 py-8">
        <p className="text-base text-content-muted">No station selected.</p>
      </div>
    )
  }

  const qs = `org_id=${orgId}`

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-1 py-0.5`
  const cellR = `${cell} text-right`

  const currentDayReport = report?.dateReports.find(r => r.date === viewDate) || null
  const currentDayHasDuplicates = duplicateDates.includes(viewDate)

  return (
    <AccessGate orgId={orgId} pageKey="report-daily-sales">
      {({ isOwner }) => (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] lg:max-w-none mx-auto px-4 sm:px-6 lg:px-2">
      {/* Duplicate entry warning */}
      {currentDayHasDuplicates && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-amber-800 dark:text-amber-200 px-3 py-2 text-sm mb-1 shrink-0">
          <span className="font-bold">Warning:</span> Multiple entries exist for {viewDate}. This may cause incorrect calculations. Please delete the duplicate from the <Link href={`/dashboard/entries/daily-sales/list?${qs}`} className="underline font-medium">entries list</Link>.
        </div>
      )}
      {/* Header — fixed at top */}
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
          <button
            onClick={() => setShowEditModal(true)}
            disabled={!report || !currentDayReport}
            className={`px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 ${BTN_FRAMED}`}
            title="Edit entries for this day"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          {isOwner && (
          <button
            onClick={handleExport}
            disabled={exporting || !report}
            className={`px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 ${BTN_FRAMED}`}
            title="Export to Excel"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
          </button>
          )}
        </div>
      </div>
      {askedToExport && !paid && <div className="mb-3 shrink-0"><PaidNote what="Exporting a report" /></div>}

      {/* Scrollable content area */}
      {!generated ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-content-faint text-sm">Select a date range and click Load.</p>
        </div>
      ) : !report ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
        </div>
      ) : currentDayReport && (
        <div className={`flex-1 overflow-y-auto overflow-x-auto lg:overflow-x-hidden min-h-0 mb-3 ${REPORT_CARD}`}>

          {/* Two columns side by side on a computer, and no sideways scroll there: a figure too long
              for its cell wraps inside it (a phone, one column, may still scroll the pumps table). */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 pb-4 lg:[overflow-wrap:anywhere]">
            {/* ===== LEFT: DAILY SALES OPERATION ===== */}
            <div className="min-w-0">
              <div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className={subHdr}>
                      <th className={`${cell} text-left font-bold whitespace-nowrap lg:whitespace-normal`}>Pumps</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Opening</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Closing</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Dispensed</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Cons</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Actual</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Price</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDayReport.entryGroups.map((group) => (
                      <EntryGroup
                        key={group.entryIndex}
                        group={group}
                        showHeader={currentDayReport.entryCount > 1}
                        cell={cell}
                        cellR={cellR}
                        hdr={hdr}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== RIGHT: STOCK & SUMMARY ===== */}
            <div className="min-w-0">
              {/* Tank stock table */}
              <div>
                <table className="w-full border-collapse text-sm mb-4">
                  <thead>
                    <tr className={subHdr}>
                      <th className={`${cell} text-left font-bold whitespace-nowrap lg:whitespace-normal`}>Tank</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Opening</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Supply</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Closing</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Diff</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Disp.</th>
                      <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>OV/SH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentDayReport.tankSummaryRows.map((row) => (
                      <TankRow key={row.fuelType} row={row} cell={cell} cellR={cellR} subHdr={subHdr} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Lodgements table */}
              <table className="w-full border-collapse text-sm mb-4">
                <thead>
                  <tr className={subHdr}>
                    <th className={`${cell} text-left font-bold whitespace-nowrap lg:whitespace-normal`}>Account</th>
                    <th className={`${cellR} font-bold whitespace-nowrap lg:whitespace-normal`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {currentDayReport.lodgement.bankRows.filter(r => r.deposited > 0).map(row => (
                    <tr key={row.bankId}>
                      <td className={`${cell} whitespace-nowrap lg:whitespace-normal`}>
                        <span className="font-bold">{row.bankName}{row.terminalId ? ` - ${row.terminalId}` : ''}</span>
                        <span className="text-xs text-content-faint ml-1">({row.lodgementType === 'bank_deposit' ? 'deposit' : row.lodgementType})</span>
                      </td>
                      <td className={cellR}>{fmt(row.deposited)}</td>
                    </tr>
                  ))}
                  {currentDayReport.lodgement.totalAll === 0 && (
                    <tr><td colSpan={2} className={`${cell} text-content-faint`}>No lodgements</td></tr>
                  )}
                  {currentDayReport.lodgement.totalAll > 0 && (
                    <tr className={`${subHdr} font-bold`}>
                      <td className={cell}>Total Lodged</td>
                      <td className={cellR}>{fmt(currentDayReport.lodgement.totalAll)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

            </div>
          </div>

          {/* ===== BELOW: BALANCES, THEN CONSUMPTION, POUR BACK, TOTALS ===== */}
          {/* Under both columns, after the divider, one row of two boxes: the Balances table (when
              the day has any), then the totals table in sections, each with its own heading row:
              Consumption, Pour Back (when the day has any), then the day's Totals. Side by side on
              a computer, one under the other on a phone. */}
          {(() => {
            const consEntries = currentDayReport.consumption.entries.filter(e => !e.isPourBack)
            const pbEntries = currentDayReport.consumption.entries.filter(e => e.isPourBack)
            const section = (title, entries) => entries.length > 0 && (
              <>
                <tr className={subHdr}>
                  <th className={`${cell} text-left font-bold`} colSpan={3}>{title}</th>
                </tr>
                <tr className={subHdr}>
                  <th className={`${cell} text-left font-bold`}>Account</th>
                  <th className={`${cell} text-left font-bold`}>Fuel</th>
                  <th className={`${cellR} font-bold`}>Qty</th>
                </tr>
                {entries.map((c, i) => (
                  <tr key={`${title}-${i}`}>
                    <td className={cell}>{customerMap[c.customerId] || 'Unknown'}</td>
                    <td className={cell}>{c.fuelType || ''}</td>
                    <td className={cellR}>{fmt(c.quantity)}</td>
                  </tr>
                ))}
              </>
            )
            return (
              <>
              {/* A divider sets the totals apart from the rest of the report above. */}
              <hr className="my-4 border-t-2 border-primary-500/40 dark:border-primary-400/40" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4 lg:[overflow-wrap:anywhere]">
              {/* The balances table */}
              {/* Credit customers' balances at the end of the day, the ones not at zero. On a day
                  with none the left box stays, empty, on a computer so the totals keep to the
                  right; on a phone it goes. */}
              <div className="min-w-0 empty:hidden lg:empty:block">
              {currentDayReport.balances.rows.length > 0 && (
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      <tr className={subHdr}>
                        <th className={`${cell} text-left font-bold`} colSpan={3}>Balances</th>
                      </tr>
                      <tr className={subHdr}>
                        <th className={`${cell} text-left font-bold`}>Customer</th>
                        <th className={`${cellR} font-bold`}>Owes station</th>
                        <th className={`${cellR} font-bold`}>Station owes</th>
                      </tr>
                      {currentDayReport.balances.rows.map((b) => (
                        <tr key={b.customerId}>
                          <td className={cell}>{b.name}</td>
                          <td className={cellR}>{b.owesStation ? fmt(b.owesStation) : ''}</td>
                          <td className={cellR}>{b.stationOwes ? fmt(b.stationOwes) : ''}</td>
                        </tr>
                      ))}
                      <tr className="font-bold">
                        <td className={cell}>Total</td>
                        <td className={cellR}>{fmt(currentDayReport.balances.totalOwesStation)}</td>
                        <td className={cellR}>{fmt(currentDayReport.balances.totalStationOwes)}</td>
                      </tr>
                    </tbody>
                  </table>
              )}
              </div>
              {/* The totals table */}
              <div className="min-w-0">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {section('Consumption', consEntries)}
                    {section('Pour Back', pbEntries)}
                    <tr className={subHdr}>
                      <th className={`${cell} text-left font-bold`}>Totals</th>
                      <th className={`${cellR} font-bold`}>Sales</th>
                      <th className={`${cellR} font-bold`}>Amount</th>
                    </tr>
                    {report.fuelTypes.map(ft => (
                      <tr key={ft}>
                        <td className={`${cell} font-bold`}>{ft}</td>
                        <td className={cellR}>{fmt(currentDayReport.dayFuelTotals[ft]?.actual)}</td>
                        <td className={cellR}>{fmt(currentDayReport.dayFuelTotals[ft]?.amount)}</td>
                      </tr>
                    ))}
                    <tr className={`${subHdr} font-bold`}>
                      <td colSpan={2} className={cell}>SALES</td>
                      <td className={cellR}>{fmt(currentDayReport.totalSales)}</td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={2} className={cell}>TOTAL POS</td>
                      <td className={cellR}>{fmt(currentDayReport.lodgement.totalPOS)}</td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={2} className={cell}>TOTAL TRANSFER</td>
                      <td className={cellR}>{fmt(currentDayReport.lodgement.totalTransfer)}</td>
                    </tr>
                    <tr className={`${subHdr} font-bold`}>
                      <td colSpan={2} className={cell}>CASH</td>
                      <td className={cellR}>{fmt(currentDayReport.cashBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              </div>
              </>
            )
          })()}
        </div>
      )}

      {/* Day tabs — fixed at bottom */}
      {generated && report?.dateReports && (
        <>
          {/* Mobile: touch-scrollable strip */}
          <div className="flex overflow-x-auto justify-center shrink-0 border-t border-primary-500/40 md:hidden">
            {report.dateReports.map(dr => {
              const d = new Date(dr.date + 'T00:00:00')
              const isActive = dr.date === viewDate
              return (
                <button
                  key={dr.date}
                  onClick={() => setViewDate(dr.date)}
                  className={`px-2 py-1.5 text-sm font-medium border-r border-primary-500/40 shrink-0 ${isActive ? 'bg-primary-500 text-white' : dr.hasEntry ? 'bg-surface text-primary-600' : 'bg-subtle text-content-faint'}`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
          {/* Desktop: arrow-controlled window */}
          <div className="hidden md:flex items-center justify-center shrink-0 border-t border-primary-500/40">
            <button
              onClick={() => setTabOffset(Math.max(0, tabOffset - 1))}
              disabled={tabOffset <= 0}
              className="p-1.5 hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex overflow-hidden">
              {report.dateReports.slice(tabOffset, tabOffset + TAB_COUNT).map(dr => {
                const d = new Date(dr.date + 'T00:00:00')
                const isActive = dr.date === viewDate
                return (
                  <button
                    key={dr.date}
                    onClick={() => setViewDate(dr.date)}
                    className={`px-2 py-1.5 text-sm font-medium border-r border-primary-500/40 ${isActive ? 'bg-primary-500 text-white' : dr.hasEntry ? 'bg-surface text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40' : 'bg-subtle text-content-faint hover:bg-subtle'}`}
                  >
                    {d.getDate()}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setTabOffset(Math.min(report.dateReports.length - TAB_COUNT, tabOffset + 1))}
              disabled={tabOffset >= report.dateReports.length - TAB_COUNT}
              className="p-1.5 hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* Edit modal */}
      {showEditModal && currentDayReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-surface w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <h3 className="text-sm font-bold text-content">
                Edit entries for {(() => { const d = new Date(viewDate + 'T00:00:00'); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}` })()}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-content-faint hover:text-content-muted p-1 -m-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 flex flex-col gap-2">
              <Link
                href={`/dashboard/entries/daily-sales?${qs}&edit_date=${viewDate}`}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium text-content ${CARD} ${CARD_HOVER}`}
              >
                <Pencil className="w-4 h-4 text-primary-600" /> Daily Sales
              </Link>
              <Link
                href={`/dashboard/entries/lodgements?${qs}&edit_date=${viewDate}`}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium text-content ${CARD} ${CARD_HOVER}`}
              >
                <Pencil className="w-4 h-4 text-primary-600" /> Lodgements
              </Link>
              <Link
                href={`/dashboard/entries/product-receipt?${qs}&edit_date=${viewDate}`}
                className={`flex items-center gap-2 px-3 py-3 text-sm font-medium text-content ${CARD} ${CARD_HOVER}`}
              >
                <Pencil className="w-4 h-4 text-primary-600" /> Product Receipt
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
      )}
    </AccessGate>
  )
}

/** Renders all fuel groups for a single entry */
function EntryGroup({ group, showHeader, cell, cellR, hdr }) {
  return (
    <>
      {showHeader && (
        <tr className={hdr}>
          <td colSpan={8} className={`${cell} font-bold`}>
            Entry {group.entryIndex}
          </td>
        </tr>
      )}
      {group.nozzleRows.map(({ fuelType, rows, totals }) => (
        <FuelGroup key={fuelType} rows={rows} totals={totals} cell={cell} cellR={cellR} />
      ))}
    </>
  )
}

/** Renders a fuel type group (e.g. all PMS nozzles + subtotal row) */
function FuelGroup({ rows, totals, cell, cellR }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.label}>
          <td className={`${cell} font-bold whitespace-nowrap`}>{r.label}</td>
          <td className={cellR}>{fmt(r.opening)}</td>
          <td className={cellR}>{fmt(r.closing)}</td>
          <td className={cellR}>{fmt(r.dispensed)}</td>
          <td className={cellR}>{fmt(r.consumed)}</td>
          <td className={cellR}></td>
          <td className={cellR}></td>
          <td className={cellR}></td>
        </tr>
      ))}
      {/* Subtotal row */}
      <tr className="bg-primary-50 dark:bg-primary-950/40 font-bold">
        <td className={cell}></td>
        <td className={cellR}></td>
        <td className={cellR}></td>
        <td className={cellR}>{fmt(totals.dispensed)}</td>
        <td className={cellR}>{fmt(totals.consumed)}</td>
        <td className={cellR}>{fmt(totals.actual)}</td>
        <td className={cellR}>{fmt(totals.price)}</td>
        <td className={cellR}>{fmt(totals.amount)}</td>
      </tr>
    </>
  )
}

/** Renders tank summary rows for a fuel type */
function TankRow({ row, cell, cellR, subHdr }) {
  const totalOvshColor = row.totalOvsh < 0 ? 'text-red-600 dark:text-red-400' : row.totalOvsh > 0 ? 'text-green-600 dark:text-green-400' : ''

  return (
    <>
      {row.tanks.map((t) => {
        const ovshColor = t.ovsh < 0 ? 'text-red-600 dark:text-red-400' : t.ovsh > 0 ? 'text-green-600 dark:text-green-400' : ''
        return (
          <tr key={t.label}>
            <td className={`${cell} font-bold whitespace-nowrap`}>{t.label}</td>
            <td className={cellR}>{fmt(t.opening)}</td>
            <td className={cellR}>{t.supply ? fmt(t.supply) : ''}</td>
            <td className={cellR}>{fmt(t.closing)}</td>
            <td className={cellR}>{fmt(t.diff)}</td>
            <td className={cellR}>{fmt(t.dispensed)}</td>
            <td className={`${cellR} ${ovshColor}`}>
              {t.ovsh > 0 ? '+' : ''}{fmt(t.ovsh)}
            </td>
          </tr>
        )
      })}
      {row.tanks.length > 1 && (
        <tr className={`${subHdr} font-bold`}>
          <td className={cell}>Total</td>
          <td className={cellR}>{fmt(row.totalOpening)}</td>
          <td className={cellR}>{row.totalSupply ? fmt(row.totalSupply) : ''}</td>
          <td className={cellR}>{fmt(row.totalClosing)}</td>
          <td className={cellR}>{fmt(row.totalDiff)}</td>
          <td className={cellR}>{fmt(row.totalDispensed)}</td>
          <td className={`${cellR} ${totalOvshColor}`}>
            {row.totalOvsh > 0 ? '+' : ''}{fmt(row.totalOvsh)}
          </td>
        </tr>
      )}
    </>
  )
}
