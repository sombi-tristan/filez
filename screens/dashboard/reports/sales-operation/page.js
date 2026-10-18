'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { db } from '@/lib/db'
import { buildSalesOperationReport } from '@/lib/buildSalesOperationReport'
import { exportSalesOperationExcel } from '@/lib/exportSalesOperationExcel'
import { exportSalesOperationGenericExcel } from '@/lib/exportSalesOperationGenericExcel'
import { REPORT_CARD, REPORT_HEAD, REPORT_SUBHEAD, REPORT_LINE } from '@/components/ui'
import DateRange from '@/components/reports/DateRange'
import AccessGate from '@/components/AccessGate'
import { isRainoilGroup } from '@/lib/exportGroup'

// The longest range one run covers, as on the audit report.
const MAX_DAYS = 32

/** The number of days from start to end, both counted. */
function rangeDays(start, end) {
  if (!start || !end) return 0
  return Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1
}

function fmt(n) {
  if (n == null || isNaN(n) || n === '') return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function SalesOperationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <SalesOperationContent />
    </Suspense>
  )
}

function SalesOperationContent() {
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
  const [generated, setGenerated] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)
  const [activeSheetName, setActiveSheetName] = useState('')
  const [tabOffset, setTabOffset] = useState(0)
  const TAB_COUNT = 14

  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])
  const [lubeProducts, setLubeProducts] = useState([])
  const [stationName, setStationName] = useState('')
  // The station's group, once known (null until then): the report is Rainoil's own form.
  const [stationGroup, setStationGroup] = useState(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      const [noz, tnk, bnk, lp] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
        db.lubeProducts.where('orgId').equals(orgId).toArray(),
      ])
      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setNozzles(noz)
      setTanks(tnk)
      setBanks(bnk)
      setLubeProducts(lp)
      setLoading(false)

      fetch('/api/organizations').then(r => r.ok ? r.json() : null).then(data => {
        if (cancelled || !data) return
        const all = [...(data.stations || []), ...(data.memberStations || [])]
        const match = all.find(s => s.id === orgId)
        if (match) setStationName(match.name || '')
        setStationGroup(match?.station_group || '')
      }).catch(() => setStationGroup(''))
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  const liveSales = useLiveQuery(() => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [], [orgId])
  const liveReceipts = useLiveQuery(() => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [], [orgId])
  const liveLodgements = useLiveQuery(() => orgId ? db.lodgements.where('orgId').equals(orgId).toArray() : [], [orgId])
  const liveLubeSales = useLiveQuery(() => orgId ? db.lubeSales.where('orgId').equals(orgId).toArray() : [], [orgId])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length) return null
    if (!liveSales || !liveReceipts || !liveLodgements || !liveLubeSales) return null

    return buildSalesOperationReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: liveLodgements,
      lubeSales: liveLubeSales,
      lubeProducts,
      nozzles,
      tanks,
      banks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, banks, lubeProducts, liveSales, liveReceipts, liveLodgements, liveLubeSales])

  useEffect(() => {
    if (!report?.sheets?.length) return
    if (!report.sheets.find(s => s.sheetName === activeSheetName)) {
      setActiveSheetName(report.sheets[0].sheetName)
      setTabOffset(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report])

  useEffect(() => {
    if (!report?.sheets) return
    const idx = report.sheets.findIndex(s => s.sheetName === activeSheetName)
    if (idx < tabOffset) setTabOffset(idx)
    else if (idx >= tabOffset + TAB_COUNT) setTabOffset(idx - TAB_COUNT + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSheetName, report])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    if (rangeDays(s, e) > MAX_DAYS) return
    setGenerating(true)
    setTimeout(() => {
      setReportStart(s)
      setReportEnd(e)
      setGenerated(true)
      setGenerating(false)
    }, 500)
  }

  const handleExport = async () => {
    if (!report) return
    setExporting(true)
    try {
      // Rainoil stations export their own form; every other station a plain workbook.
      const exportFn = isRainoilGroup(stationGroup) ? exportSalesOperationExcel : exportSalesOperationGenericExcel
      await exportFn({
        report,
        stationName,
        startDate: reportStart,
        endDate: reportEnd,
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading || (orgId && stationGroup === null)) {
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

  const activeSheet = report?.sheets.find(s => s.sheetName === activeSheetName) || null

  return (
    <AccessGate orgId={orgId} pageKey="report-sales-operation">
      {({ isOwner }) => (
        <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] lg:max-w-none mx-auto px-4 sm:px-6 lg:px-2">
          <div className="flex items-center justify-end py-3 shrink-0">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DateRange
                start={startDate}
                end={endDate}
                onStart={setStartDate}
                onEnd={setEndDate}
                onGenerate={handleGenerate}
                generating={generating}
                disabled={!startDate || !endDate || startDate > endDate || rangeDays(startDate, endDate) > MAX_DAYS}
              />
              {isOwner && (
                <button
                  onClick={handleExport}
                  disabled={exporting || !report}
                  className="px-3 py-2 bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5"
                  title="Export to Excel"
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
                </button>
              )}
            </div>
          </div>
          {rangeDays(startDate, endDate) > MAX_DAYS && (
            <p className="text-xs text-red-500 mb-2 shrink-0 text-right">Date range cannot exceed {MAX_DAYS} days ({rangeDays(startDate, endDate)} days selected).</p>
          )}

          {!generated ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-content-faint text-sm">Select a date range and click Load.</p>
            </div>
          ) : !report ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
            </div>
          ) : !activeSheet ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-content-faint text-sm">No sheets in this range.</p>
            </div>
          ) : (
            <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 ${REPORT_CARD}`}>
              <div className="px-4 sm:px-8 py-4">
                {/* The whole day on one page, its parts in the form's order, in the app's report
                    styling; the day is chosen in the tabs below. */}
                <h2 className="mb-3 text-base font-bold text-content">{stationName ? `${stationName}: ` : ''}{activeSheet.sheetName}</h2>
                <SalesSection sheet={activeSheet} />
                <StockSection sheet={activeSheet} />
                <CashSection sheet={activeSheet} />
                <LubeSection sheet={activeSheet} />
              </div>
            </div>
          )}

          {generated && report?.sheets?.length > 0 && (
            <>
              <div className="flex overflow-x-auto shrink-0 border-t border-primary-500/40 md:hidden">
                {report.sheets.map(s => {
                  const isActive = s.sheetName === activeSheetName
                  return (
                    <button
                      key={s.sheetName}
                      onClick={() => setActiveSheetName(s.sheetName)}
                      className={`px-2 py-1.5 text-xs font-medium border-r border-primary-500/40 shrink-0 ${isActive ? 'bg-primary-500 text-white' : 'bg-surface text-primary-600'}`}
                    >
                      {s.sheetName}
                    </button>
                  )
                })}
              </div>
              <div className="hidden md:flex items-center justify-center shrink-0 border-t border-primary-500/40">
                <button
                  onClick={() => setTabOffset(Math.max(0, tabOffset - 1))}
                  disabled={tabOffset <= 0}
                  className="p-1.5 hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex overflow-hidden">
                  {report.sheets.slice(tabOffset, tabOffset + TAB_COUNT).map(s => {
                    const isActive = s.sheetName === activeSheetName
                    return (
                      <button
                        key={s.sheetName}
                        onClick={() => setActiveSheetName(s.sheetName)}
                        className={`px-3 py-1.5 text-sm font-medium border-r border-primary-500/40 ${isActive ? 'bg-primary-500 text-white' : 'bg-surface text-primary-600 hover:bg-primary-50'}`}
                      >
                        {s.sheetName}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setTabOffset(Math.min(Math.max(0, report.sheets.length - TAB_COUNT), tabOffset + 1))}
                  disabled={tabOffset >= report.sheets.length - TAB_COUNT}
                  className="p-1.5 hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </AccessGate>
  )
}

// ─── The sections: plain report tables, as on the audit report ───

const cell = `border ${REPORT_LINE} px-1.5 py-1`
const cellR = `${cell} text-right`

/** A titled table: a header row, body rows (the first cell a label), an optional total row. */
function ReportTable({ title, head, rows, total }) {
  return (
    <div className="mb-6">
      <div className={`${REPORT_HEAD} px-2 py-1.5 text-sm font-bold`}>{title}</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className={REPORT_SUBHEAD}>
            {head.map((h, i) => <th key={i} className={`${i ? cellR : `${cell} text-left`} font-bold`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((v, i) => <td key={i} className={i ? cellR : `${cell} font-bold`}>{v}</td>)}
            </tr>
          ))}
          {total && (
            <tr className={`${REPORT_SUBHEAD} font-bold`}>
              {total.map((v, i) => <td key={i} className={i ? cellR : cell}>{v}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function SalesSection({ sheet }) {
  return (
    <ReportTable
      title="Sales"
      head={['Fuel', 'Price 1', 'Actual sales @P1', 'RTT @P1', 'Cons. @P1', 'Price 2', 'Actual sales @P2', 'RTT @P2', 'Cons. @P2', 'Total actual (L)', 'Amount (₦)']}
      rows={sheet.fuel.map((f) => [f.fuelType, fmt(f.price1), fmt(f.actualSalesP1), fmt(f.rttP1), fmt(f.consP1), fmt(f.price2), fmt(f.actualSalesP2), fmt(f.rttP2), fmt(f.consP2), fmt(f.totalActualLtrs), fmt(f.amount)])}
      total={['Total', '', '', '', '', '', '', '', '', fmt(sheet.fuel.reduce((t, f) => t + f.totalActualLtrs, 0)), fmt(sheet.fuel.reduce((t, f) => t + f.amount, 0))]}
    />
  )
}

function StockSection({ sheet }) {
  return (
    <>
      <ReportTable
        title="Stock"
        head={['Fuel', 'Opening', 'Waybill', 'Actual received', 'Truck shortage', 'Total dispensed', 'Closing']}
        rows={sheet.stock.map((s) => [s.fuelType, fmt(s.opening), fmt(s.waybill), fmt(s.actualReceived), fmt(s.truckShortage), fmt(s.totalDispensed), fmt(s.closing)])}
      />
      <ReportTable
        title="Overage"
        head={['Fuel', 'Expected overage', 'Actual overage', 'Variance', 'Comment']}
        rows={(sheet.overage || []).map((o) => [o.fuelType, fmt(Math.round(o.expected)), fmt(Math.round(o.actual)), fmt(Math.round(o.variance)),
          o.variance > 0 ? 'Liquid height variation on the positive side' : 'Liquid height variation on the negative side'])}
      />
    </>
  )
}

function CashSection({ sheet }) {
  const { deposits = [], pos = [], transfers = [] } = sheet.lodgements || {}
  const lodged = [
    ...deposits.map((d) => ['Bank deposit', d.bankName, d.amount]),
    ...pos.map((d) => ['POS', d.bankName, d.amount]),
    ...transfers.map((d) => ['Transfer', d.bankName, d.amount]),
  ]
  const cash = sheet.cash
  return (
    <>
      <ReportTable
        title="Lodgements"
        head={['Type', 'Bank', 'Amount (₦)']}
        rows={lodged.length ? lodged.map(([t, b, a]) => [t, b, fmt(a)]) : [['None', '', '']]}
        total={['Total', '', fmt(lodged.reduce((t, r) => t + r[2], 0))]}
      />
      <ReportTable
        title="Cash"
        head={['', 'Total expected sales', 'Previous day cash @ hand', 'Total bank deposit', 'Total POS & Transfer', 'Expected Cash @ Hand', 'Actual cash @ hand', 'Variance']}
        rows={[['Amount (₦)', fmt(cash.totalExpectedSales), fmt(cash.prevDayCash), fmt(cash.totalBankDeposit), fmt(cash.totalPOS + cash.totalTransfer), fmt(cash.expectedCashAtHand), fmt(cash.actualCashAtHand), fmt(cash.variance)]]}
      />
    </>
  )
}

function LubeSection({ sheet }) {
  if (!sheet.lube?.length) return <ReportTable title="Lube" head={['Product']} rows={[['No lube products with stock or sales on this day.']]} />
  return (
    <ReportTable
      title="Lube"
      head={['Product', 'Litre', 'Unit price', 'Opening', 'Supply', 'Sales', 'Closing', 'Amount (₦)', 'Variance']}
      rows={sheet.lube.map((l) => [l.productName, fmt(l.litre), fmt(l.unitPrice), fmt(l.openingStock), fmt(l.productSupply), fmt(l.sales), fmt(l.closingStock), fmt(l.amount), fmt(l.variance)])}
      total={['Total', '', '', '', '', fmt(sheet.lube.reduce((t, l) => t + l.sales, 0)), '', fmt(sheet.lube.reduce((t, l) => t + l.amount, 0)), '']}
    />
  )
}
