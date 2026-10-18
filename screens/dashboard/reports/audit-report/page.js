'use client'

import { Fragment, Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, Download, ShieldX } from 'lucide-react'
import { db } from '@/lib/db'
import { buildAuditReport } from '@/lib/buildAuditReport'
import { exportAuditExcel } from '@/lib/exportAuditExcel'
import { exportAuditGenericExcel } from '@/lib/exportAuditGenericExcel'
import { isRainoilGroup } from '@/lib/exportGroup'
import DateRange from '@/components/reports/DateRange'
import { defaultReportStart, exportAllowed } from '@/lib/reportRange'
import { useLicence, PaidNote } from '@/components/desktop/LicenceGate'
import AccessGate from '@/components/AccessGate'
import { fmtDate } from '@/lib/formatDate'
import { REPORT_HEAD, REPORT_SUBHEAD, REPORT_LINE, OUTLINE_WITHIN, BTN_FRAMED, BTN_PRIMARY, REPORT_CARD } from '@/components/ui'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const SUB_REPORTS = [
  { key: 'sales-cash', label: 'Sales/Cash Position' },
  { key: 'stock-summary', label: 'Stock Position' },
  { key: 'lodgement-sheet', label: 'Lodgement Sheet' },
  { key: 'consumption', label: 'Consumption & Pour Back' },
  { key: 'product-received', label: 'Product Received' },
  { key: 'stock-position', label: 'Record of Stock Position' },
  { key: 'calculator', label: 'Calculator' },
]

export default function AuditReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <AuditReportContent />
    </Suspense>
  )
}

// Extended template limits (1-indexed) — max capacity for truncation check
const EXT_SECTIONS = {
  PMS: { pumpStart: 10, pumpEnd: 163 },
  AGO: { pumpStart: 196, pumpEnd: 251 },
  DPK: { pumpStart: 290, pumpEnd: 335 },
}

function checkTruncationWarnings(report, nozzles) {
  const warnings = []
  if (!report?.salesCash?.fuelSummaries) return warnings
  for (const ft of report.fuelTypes || []) {
    const sec = EXT_SECTIONS[ft]
    if (!sec) continue
    const summary = report.salesCash.fuelSummaries[ft]
    if (!summary?.rows?.length) continue
    const pumpCount = nozzles.filter(n => n.fuel_type === ft).length
    if (!pumpCount) continue
    const blockSize = pumpCount + 1
    const maxBlocks = Math.floor((sec.pumpEnd - sec.pumpStart + 1) / blockSize)
    if (summary.rows.length > maxBlocks) {
      warnings.push(`${ft}: ${summary.rows.length} price periods but only ${maxBlocks} fit in template. Meter readings will be truncated.`)
    }
  }
  return warnings
}

function AuditReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [banks, setBanks] = useState([])
  const [tanks, setTanks] = useState([])
  const [stationName, setStationName] = useState('')
  // Selects the export format, via isRainoilGroup in lib/exportGroup.
  const [stationGroup, setStationGroup] = useState('')
  const [allowedSubReports, setAllowedSubReports] = useState(null) // null = all (owner)

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
  const [generated, setGenerated] = useState(true)
  const [activeTab, setActiveTab] = useState('sales-cash')

  // Check sub-report access (null = owner/legacy = all allowed)
  const canAccessTab = (tabKey) => allowedSubReports === null || allowedSubReports.includes(tabKey)

  // Committed date range (only updates on Generate)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      const [noz, bnk, tnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
      ])
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      setNozzles(noz)
      setBanks(bnk)
      setTanks(tnk)
      setLoading(false)

      // Station name and group, for the export. Asked for by id rather than as a list: the
      // list form returns only owned and member stations, so an admin got neither, and the
      // by-id form routes through hasStationAccess which admits them.
      fetch(`/api/organizations?org_id=${encodeURIComponent(orgId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (cancelled || !data) return
          const match = (data.stations || [])[0]
          if (match) {
            setStationName(match.name || '')
            setStationGroup(match.station_group || '')
          }
        }).catch(() => {})

      // Fetch admin-uploaded template URL (non-blocking)
      fetch('/api/excel-templates?name=AUDIT+REPORT+TEMPLATE').then(r => r.ok ? r.json() : null).then(data => {
        if (cancelled || !data?.url) return
        setTemplateUrl(data.url)
      }).catch(() => {})

      // Fetch staff permissions to filter sub-reports (non-blocking)
      fetch(`/api/invites?org_id=${orgId}`).then(r => r.ok ? r.json() : null).then(data => {
        if (cancelled || !data?.visiblePages) return
        const pages = data.visiblePages
        // Old key 'report-audit' without sub-keys = show all sub-reports
        const hasLegacyKey = pages.includes('report-audit')
        const subKeys = pages.filter(p => p.startsWith('report-audit-'))
        if (subKeys.length > 0) {
          // Map page keys to sub-report keys: 'report-audit-sales-cash' -> 'sales-cash'
          setAllowedSubReports(subKeys.map(k => k.replace('report-audit-', '')))
        } else if (!hasLegacyKey) {
          setAllowedSubReports([]) // no audit access at all
        }
        // null (default) = owner or legacy key = show all
      }).catch(() => {})
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  // Live queries
  const liveSales = useLiveQuery(
    () => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [],
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
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLubeSales = useLiveQuery(
    () => orgId ? db.lubeSales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLubeStock = useLiveQuery(
    () => orgId ? db.lubeStock.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveLubeProducts = useLiveQuery(
    () => orgId ? db.lubeProducts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const [exporting, setExporting] = useState(false)
  // Exporting is a paid feature: without a subscription the button shows PaidNote instead.
  const paid = Boolean(useLicence()?.paid)
  const [askedToExport, setAskedToExport] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [templateUrl, setTemplateUrl] = useState(null)

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveLodgements) return null

    return buildAuditReport({
      sales: liveSales,
      lodgements: liveLodgements,
      receipts: liveReceipts || [],
      nozzles,
      banks,
      tanks,
      customers: liveCustomers || [],
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, banks, tanks, liveSales, liveLodgements, liveCustomers, liveReceipts])

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const ms = new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')
    return Math.floor(ms / 86400000) + 1
  }, [startDate, endDate])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    if (dateRangeDays > 32) {
      alert('Date range cannot exceed 32 days.')
      return
    }
    setGenerating(true)
    setTimeout(() => {
      setReportStart(s)
      setReportEnd(e)
      setGenerated(true)
      setActiveTab('sales-cash')
      setGenerating(false)
    }, 2000)
  }

  const handleExport = async () => {
    if (!report || exporting) return
    if (!exportAllowed()) { setAskedToExport(true); return }
    setExporting(true)
    try {
      // Pre-check for truncation warnings
      const warnings = checkTruncationWarnings(report, nozzles)
      if (warnings.length) {
        const proceed = window.confirm(
          'Some data will be truncated:\n\n' + warnings.join('\n') + '\n\nProceed with export?'
        )
        if (!proceed) { setExporting(false); return }
      }

      const isRainoil = isRainoilGroup(stationGroup)

      // Which workbook a station gets is decided by its group. exportAuditExcel is a replica
      // of Rainoil's own audit pack, down to their logo and sheet numbering, so it is theirs
      // alone; everyone else gets the plain one.
      //
      const result = isRainoil
        ? await exportAuditExcel({
            report,
            receipts: liveReceipts || [],
            lubeSales: liveLubeSales || [],
            lubeStock: liveLubeStock || [],
            lubeProducts: liveLubeProducts || [],
            tanks,
            nozzles,
            stationName,
            startDate: reportStart,
            endDate: reportEnd,
            templateUrl,
          })
        : await exportAuditGenericExcel({
            report,
            receipts: liveReceipts || [],
            stationName,
            startDate: reportStart,
            endDate: reportEnd,
          })
      if (result.warnings?.length) {
        alert('Export completed with warnings:\n\n' + result.warnings.join('\n'))
      }
    } catch (err) {
      console.error('Excel export failed:', err)
      alert('Export failed: ' + (err?.message || String(err)))
    } finally {
      setExporting(false)
    }
  }

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

  return (
    <AccessGate orgId={orgId} pageKey="report-audit">
      {({ isOwner }) => (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] lg:max-w-none mx-auto px-4 sm:px-6 lg:px-2">
      {/* Header + date range */}
      <div className="flex items-center justify-end py-3 shrink-0">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateRange
            start={startDate}
            end={endDate}
            onStart={setStartDate}
            onEnd={setEndDate}
            onGenerate={handleGenerate}
            generating={generating}
            disabled={!startDate || !endDate || startDate > endDate || dateRangeDays > 32}
          />
          {isOwner && report && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className={`px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 ${BTN_FRAMED}`}
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export
            </button>
          )}
        </div>
      </div>
      {dateRangeDays > 32 && (
        <p className="text-xs text-red-500 mt-1">Date range cannot exceed 32 days ({dateRangeDays} days selected).</p>
      )}
      {askedToExport && !paid && <div className="mb-3 shrink-0"><PaidNote what="Exporting a report" /></div>}

      {/* Report content */}
      {report ? (
        <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 ${REPORT_CARD}`}>
          {!canAccessTab(activeTab) ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/40 border border-red-100 rounded max-w-md">
                <ShieldX className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  You don&apos;t have permission to view this report. Contact the station owner to update your access.
                </p>
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-8 py-4">
              {activeTab === 'sales-cash' && (
                <SalesCashPosition report={report} startDate={reportStart} endDate={reportEnd} />
              )}
              {activeTab === 'lodgement-sheet' && (
                <LodgementSheet report={report} />
              )}
              {activeTab === 'stock-position' && (
                <StockPosition report={report} />
              )}
              {activeTab === 'stock-summary' && (
                <StockSummary report={report} startDate={reportStart} endDate={reportEnd} />
              )}
              {activeTab === 'consumption' && (
                <ConsumptionReport report={report} startDate={reportStart} endDate={reportEnd} />
              )}
              {activeTab === 'product-received' && (
                <ProductReceived receipts={liveReceipts || []} tanks={tanks} startDate={reportStart} endDate={reportEnd} />
              )}
              {activeTab === 'calculator' && (
                <CalculatorReport report={report} startDate={reportStart} endDate={reportEnd} />
              )}
            </div>
          )}
        </div>
      ) : generated ? (
        <div className="flex-1 flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-content-faint text-sm">Select a date range and click Load.</p>
        </div>
      )}

      {/* Sub-report tabs (bottom, Excel-style) */}
      {generated && report && (
        <div className="flex overflow-x-auto shrink-0 border-t border-primary-500/40 bg-subtle">
          {SUB_REPORTS.map(tab => {
            const allowed = canAccessTab(tab.key)
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 text-sm font-medium border-r border-primary-500/40 shrink-0 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? allowed
                      ? 'bg-surface text-primary-600 border-t-2 border-t-blue-600 -mt-px'
                      : 'bg-surface text-red-400 border-t-2 border-t-red-400 -mt-px'
                    : allowed
                      ? 'bg-subtle text-content-muted hover:bg-surface hover:text-primary-600'
                      : 'bg-subtle text-content-faint'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
      )}
    </AccessGate>
  )
}

// ─── Sales / Cash Position sub-report ───

function SalesCashPosition({ report, startDate, endDate }) {
  const { salesCash, fuelTypes } = report
  if (!salesCash) return null

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-1.5 py-1`
  const cellR = `${cell} text-right`

  const formatDate = fmtDate

  return (
    <div className="min-w-[700px] pb-4 px-[10%]">
      <h2 className="text-base font-bold text-content mb-1">
        Cash/Sales Reconciliation — {formatDate(startDate)} to {formatDate(endDate)}
      </h2>

      {fuelTypes.map((ft, ftIdx) => {
        const summary = salesCash.fuelSummaries[ft]
        if (!summary) return null
        return (
          <FuelSection
            key={ft}
            fuelType={ft}
            index={ftIdx + 1}
            summary={summary}
            startDate={startDate}
            endDate={endDate}
            hdr={hdr}
            subHdr={subHdr}
            cell={cell}
            cellR={cellR}
          />
        )
      })}

      {/* Cash Reconciliation */}
      <CashReconciliation
        data={salesCash.cashReconciliation}
        startDate={startDate}
        endDate={endDate}
        hdr={hdr}
        subHdr={subHdr}
        cell={cell}
        cellR={cellR}
      />
    </div>
  )
}

function FuelSection({ fuelType, index, summary, startDate, endDate, hdr, subHdr, cell, cellR }) {
  const formatDate = fmtDate

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className={`${hdr} px-2 py-1.5 text-sm font-bold mb-0`}>
        {index}. {fuelType} Sales for the Period
      </div>

      {/* Meter reading table */}
      <table className="w-full border-collapse text-sm mb-0">
        <thead>
          <tr className={subHdr}>
            <th className={`${cell} text-left font-bold`}>Meter Reading</th>
            <th className={`${cellR} font-bold`}>Opening ({formatDate(startDate)})</th>
            <th className={`${cellR} font-bold`}>Closing ({formatDate(endDate)})</th>
            <th className={`${cellR} font-bold`}>Dispensed</th>
            <th className={`${cellR} font-bold`}>Price</th>
            <th className={`${cellR} font-bold`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row, rowIdx) => (
            <MeterGroup key={rowIdx} row={row} rowIdx={rowIdx} totalRows={summary.rows.length} cell={cell} cellR={cellR} />
          ))}
        </tbody>
      </table>

      {/* A = Total sales */}
      <table className="w-full border-collapse text-sm mb-4">
        <tbody>
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>A</td>
            <td className={cell}>Total {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.totalDispensed)}</td>
            <td className={cellR}></td>
            <td className={cellR}>{fmt(summary.totalAmount)}</td>
          </tr>

          {/* B = Less Pour Back */}
          <tr className="font-bold">
            <td className={cell}>B</td>
            <td className={cell} colSpan={3}>Less Pour Back on {fuelType} for the Period</td>
            <td className={cellR}>{fmt(summary.totalPourBackAmt)}</td>
          </tr>
          {(summary.consumption.pourBackByPrice || []).map((group, gi) => (
            <tr key={`pbg-${gi}`}>
              <td className={cell}></td>
              <td className={cell}>{group.name}</td>
              <td className={cellR}>{fmt(group.totalQty)}</td>
              <td className={cellR}>{fmt(group.price)}</td>
              <td className={cellR}>{fmt(group.totalAmt)}</td>
            </tr>
          ))}

          {/* C = Net Sales */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>C=A-B</td>
            <td className={cell}>Net {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.netSalesQty)}</td>
            <td className={cellR}></td>
            <td className={cellR}>{fmt(summary.netSalesAmt)}</td>
          </tr>

          {/* Less Consumption */}
          <tr className="font-bold">
            <td className={cell}></td>
            <td className={cell} colSpan={4}>Less Consumption on {fuelType}</td>
          </tr>
          {(summary.consumption.consumedByPrice || []).map((group, gi) => (
            <tr key={`cg-${gi}`}>
              <td className={cell}></td>
              <td className={cell}>{group.name}</td>
              <td className={cellR}>{fmt(group.totalQty)}</td>
              <td className={cellR}>{fmt(group.price)}</td>
              <td className={cellR}>{fmt(group.totalAmt)}</td>
            </tr>
          ))}

          {/* D = Total Consumption */}
          <tr className="font-bold">
            <td className={cell}>D</td>
            <td className={cell}>Total Consumption of {fuelType} for the Period</td>
            <td className={cellR}>{fmt(summary.totalConsumedQty)}</td>
            <td className={cellR}></td>
            <td className={cellR}>{fmt(summary.totalConsumedAmt)}</td>
          </tr>

          {/* E = Expected Sales */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>E=C-D</td>
            <td className={cell}>Expected {fuelType} Sales for the Period</td>
            <td className={cellR}>{fmt(summary.expectedSalesQty)}</td>
            <td className={cellR}></td>
            <td className={cellR}>{fmt(summary.expectedSalesAmt)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function MeterGroup({ row, rowIdx, totalRows, cell, cellR }) {
  return (
    <>
      {/* Spacer rows between price period groups */}
      {rowIdx > 0 && (
        <tr><td colSpan={6} className="h-2"></td></tr>
      )}
      {row.pumps.map((pump, pIdx) => (
        <tr key={`${rowIdx}-${pIdx}`}>
          <td className={`${cell} font-medium`}>{pump.label}</td>
          <td className={cellR}>{fmt(pump.opening)}</td>
          <td className={cellR}>{fmt(pump.closing)}</td>
          <td className={cellR}>{fmt(pump.dispensed)}</td>
          <td className={cellR}>{fmt(row.price)}</td>
          <td className={cellR}>{fmt(pump.dispensed * row.price)}</td>
        </tr>
      ))}
    </>
  )
}

function CashReconciliation({ data, startDate, endDate, hdr, subHdr, cell, cellR }) {
  const formatDate = fmtDate

  const overshortColor = data.overshort < 0 ? 'text-red-600 dark:text-red-400' : data.overshort > 0 ? 'text-green-600 dark:text-green-400' : ''
  // Note: negative = station owes (debt), positive = station overpaid

  return (
    <div className="mt-6">
      <div className={`${hdr} px-2 py-1.5 text-sm font-bold`}>
        Sales/Lodgement Reconciliation — {formatDate(startDate)} to {formatDate(endDate)}
      </div>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>Expected Sales from Products for the Period</td>
            <td className={cellR}>{fmt(data.expectedSalesTotal)}</td>
          </tr>
          <tr className="font-bold">
            <td className={cell}>Total Lodgement for the Period</td>
            <td className={cellR}>{fmt(data.totalLodgement)}</td>
          </tr>
          <tr className="font-bold">
            <td className={cell}>Total POS for the Period</td>
            <td className={cellR}>{fmt(data.totalPOS)}</td>
          </tr>
          <tr className="font-bold">
            <td className={cell}>Total Transfer for the Period</td>
            <td className={cellR}>{fmt(data.totalTransfer)}</td>
          </tr>
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}>Overage/Shortage</td>
            <td className={`${cellR} ${overshortColor}`}>
              {data.overshort > 0 ? '+' : ''}{fmt(data.overshort)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Lodgement Sheet sub-report ───

function LodgementSheet({ report }) {
  const { lodgementSheet } = report
  if (!lodgementSheet) return null

  const { rows, banks, totals } = lodgementSheet
  // POS + Transfer banks shown together in "Analysis of POS by Banks" (matching Excel)
  const displayBanks = banks.filter(b => b.lodgement_type === 'pos' || b.lodgement_type === 'transfer')
  const posOnly = banks.filter(b => b.lodgement_type === 'pos')
  const transferOnly = banks.filter(b => b.lodgement_type === 'transfer')

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-1.5 py-1 whitespace-nowrap`
  const cellR = `${cell} text-right`
  const cellEmpty = `${bdr} px-1.5 py-1 whitespace-nowrap bg-subtle`

  // fmtDate imported from @/lib/formatDate

  const fmtOvsh = (v) => {
    if (v === 0) return ''
    return v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v)
  }

  const sumBanks = (amounts, list) => list.reduce((s, b) => s + (amounts[b.id] || 0), 0)

  const totalCols = 4 + displayBanks.length + 7
  const visibleRows = rows.filter(r => r.hasData)

  return (
    <div className="min-w-[700px] pb-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={totalCols} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              LODGEMENT
            </th>
          </tr>
          <tr className={subHdr}>
            <th className={`${cell} font-bold`}>Sales Date</th>
            <th className={`${cellR} font-bold`}>Total Sales</th>
            <th className={`${cellR} font-bold`}>Cash Sales</th>
            <th className={`${cell} font-bold text-center`}>Credit</th>
            {displayBanks.length > 0 && (
              <th colSpan={displayBanks.length} className={`${cell} text-center font-bold`}>
                Analysis of POS by Banks
              </th>
            )}
            <th className={`${cellR} font-bold`}>Total POS</th>
            <th className={`${cellR} font-bold`}>Total Transfer</th>
            <th className={`${cellR} font-bold`}>Total Lodged</th>
            <th className={`${cellR} font-bold`}>Expected</th>
            <th className={`${cellR} font-bold`}>Actual</th>
            <th className={`${cellR} font-bold`}>OV/SH</th>
            <th className={`${cell} font-bold`}>Date Lodged</th>
          </tr>
          {displayBanks.length > 0 && (
            <tr className={subHdr}>
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
              {displayBanks.map(bank => (
                <th key={bank.id} className={`${cellR} font-bold text-xs`}>
                  {bank.bank_name}{bank.lodgement_type === 'transfer' ? ' (T)' : ''}
                </th>
              ))}
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
              <th className={cell}></th>
            </tr>
          )}
        </thead>
        <tbody>
          {visibleRows.map((row) => {
            const tPOS = sumBanks(row.bankAmounts, posOnly)
            const tTransfer = sumBanks(row.bankAmounts, transferOnly)
            const cashSales = row.totalSales - tPOS - tTransfer
            return (
              <tr key={row.date}>
                <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
                <td className={cellR}>{fmt(row.totalSales)}</td>
                <td className={cellR}>{fmt(cashSales)}</td>
                <td className={cellEmpty}></td>
                {displayBanks.map(bank => (
                  <td key={bank.id} className={cellR}>
                    {fmt(row.bankAmounts[bank.id] || 0)}
                  </td>
                ))}
                <td className={cellR}>{fmt(tPOS)}</td>
                <td className={cellR}>{fmt(tTransfer)}</td>
                <td className={cellR}>{fmt(tPOS + tTransfer)}</td>
                <td className={cellR}>{fmt(cashSales)}</td>
                <td className={cellR}>{fmt(row.actual)}</td>
                <td className={`${cellR} font-bold ${row.ovsh > 0 ? 'text-green-600 dark:text-green-400' : row.ovsh < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {fmtOvsh(row.ovsh)}
                </td>
                <td className={`${cellR} whitespace-nowrap`}>{row.dateLodged ? fmtDate(row.dateLodged) : ''}</td>
              </tr>
            )
          })}
          {visibleRows.length > 0 && (() => {
            const gPOS = sumBanks(totals.bankTotals, posOnly)
            const gTransfer = sumBanks(totals.bankTotals, transferOnly)
            const gCash = totals.totalSales - gPOS - gTransfer
            return (
              <tr className={`${subHdr} font-bold`}>
                <td className={cell}>Total</td>
                <td className={cellR}>{fmt(totals.totalSales)}</td>
                <td className={cellR}>{fmt(gCash)}</td>
                <td className={cellEmpty}></td>
                {displayBanks.map(bank => (
                  <td key={bank.id} className={cellR}>
                    {fmt(totals.bankTotals[bank.id] || 0)}
                  </td>
                ))}
                <td className={cellR}>{fmt(gPOS)}</td>
                <td className={cellR}>{fmt(gTransfer)}</td>
                <td className={cellR}>{fmt(gPOS + gTransfer)}</td>
                <td className={cellR}>{fmt(gCash)}</td>
                <td className={cellR}>{fmt(totals.actual)}</td>
                <td className={`${cellR} ${totals.ovsh > 0 ? 'text-green-600 dark:text-green-400' : totals.ovsh < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {fmtOvsh(totals.ovsh)}
                </td>
                <td className={cell}></td>
              </tr>
            )
          })()}
        </tbody>
      </table>
    </div>
  )
}

// ─── Stock Position sub-report ───

function StockPosition({ report }) {
  const { stockPosition, fuelTypes } = report
  const [activeFuel, setActiveFuel] = useState(fuelTypes[0] || 'PMS')

  if (!stockPosition) return null

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-1.5 py-1`
  const cellR = `${cell} text-right`

  // fmtDate imported from @/lib/formatDate

  const ovshColor = (v) => {
    if (v == null || v === 0) return ''
    return v < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
  }

  const fuelData = stockPosition[activeFuel]
  if (!fuelData) return null

  const visibleRows = fuelData.rows.filter(r => r.hasData)
  const { totals } = fuelData

  return (
    <div className="min-w-[700px] pb-4">
      {/* Fuel type tabs */}
      <div className="flex gap-1 mb-4">
        {fuelTypes.map(ft => (
          <button
            key={ft}
            onClick={() => setActiveFuel(ft)}
            className={`px-4 py-1.5 text-sm font-medium border ${
              activeFuel === ft
                ? 'bg-primary-500 text-white border-blue-600'
                : 'bg-surface text-primary-900 dark:text-primary-100 border-primary-500/40 hover:bg-primary-50 dark:hover:bg-primary-950/40'
            }`}
          >
            {ft}
          </button>
        ))}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={8} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              RECORD OF STOCK POSITION — {activeFuel}
            </th>
          </tr>
          <tr className={subHdr}>
            <th className={`${cell} font-bold`}>Date</th>
            <th className={`${cellR} font-bold`}>Opening Stock</th>
            <th className={`${cellR} font-bold`}>Actual Product Supplied</th>
            <th className={`${cellR} font-bold`}>Quantity Sold</th>
            <th className={`${cellR} font-bold`}>Closing Stock</th>
            <th className={`${cellR} font-bold`}>OV/SH</th>
            <th className={`${cellR} font-bold`}>Actual OV/SH</th>
            <th className={`${cellR} font-bold`}>VARIANCE</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map(row => (
            <tr key={row.date}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
              <td className={cellR}>{fmt(row.opening)}</td>
              <td className={cellR}>{fmt(row.supply)}</td>
              <td className={cellR}>{fmt(row.qtySold)}</td>
              <td className={cellR}>{fmt(row.closing)}</td>
              <td className={`${cellR} ${ovshColor(row.ovsh)}`}>{fmt(row.ovsh)}</td>
              <td className={`${cellR} ${ovshColor(row.actualOvsh)}`}>{fmt(row.actualOvsh)}</td>
              <td className={cellR}></td>
            </tr>
          ))}
          {visibleRows.length > 0 && (
            <tr className={`${subHdr} font-bold`}>
              <td className={cell}>Total</td>
              <td className={cellR}>{fmt(totals.opening)}</td>
              <td className={cellR}>{fmt(totals.supply)}</td>
              <td className={cellR}>{fmt(totals.qtySold)}</td>
              <td className={cellR}>{fmt(totals.closing)}</td>
              <td className={`${cellR} ${ovshColor(totals.ovsh)}`}>{fmt(totals.ovsh)}</td>
              <td className={`${cellR} ${ovshColor(totals.actualOvsh)}`}>{fmt(totals.actualOvsh)}</td>
              <td className={cellR}></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function StockSummary({ report, startDate, endDate }) {
  const { stockPosition, fuelTypes } = report
  if (!stockPosition) return null

  // fmtDate imported from @/lib/formatDate

  const hdr = `${REPORT_HEAD} font-bold`
  const cell = `border ${REPORT_LINE} px-3 py-1.5 text-sm`
  const cellR = cell + ' text-right'

  const fmtOvsh = (n) => {
    if (n == null || isNaN(n)) return ''
    const v = Number(n)
    if (v < 0) return `(${fmt(Math.abs(v))})`
    return fmt(v)
  }

  return (
    <div>
      {/* Title */}
      <div className="mb-3">
        <p className="text-xs font-bold uppercase">
          STOCK POSITION FOR THE PERIOD ({fmtDate(startDate)} - {fmtDate(endDate)})
        </p>
      </div>

      {fuelTypes.map((ft) => {
        const data = stockPosition[ft]
        if (!data) return null
        const t = data.totals
        const stockAvailable = t.opening + t.supply

        return (
          <div key={ft} className="mb-6">
            <table className="w-full border-collapse border border-primary-500/40">
              <thead>
                <tr className={hdr}>
                  <th className={cell + ' text-left w-[65%]'}>{ft} STOCK POSITION</th>
                  <th className={cell + ' text-right w-[35%]'}>Per Manager&apos;s Computation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={cell + ' font-bold'}>OPENING STOCK ({fmtDate(startDate)})</td>
                  <td className={cellR}>{fmt(t.opening)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>SUPPLIES DURING THE PERIOD</td>
                  <td className={cellR}>{fmt(t.supply)}</td>
                </tr>
                <tr className="font-bold">
                  <td className={cell}>STOCK AVAILABLE FOR SALE</td>
                  <td className={cellR}>{fmt(stockAvailable)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>CLOSING STOCK ({fmtDate(endDate)})</td>
                  <td className={cellR}>{fmt(t.closing)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>QUANTITY SOLD</td>
                  <td className={cellR}>{fmt(t.qtySold)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>QUANTITY DISPENSED</td>
                  <td className={cellR}>{fmt(t.dispensed)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>OVERAGE/(SHORTAGE)</td>
                  <td className={cellR}>{fmtOvsh(t.ovsh)}</td>
                </tr>
                {/* Spacer */}
                <tr>
                  <td className={cell}>&nbsp;</td>
                  <td className={cell}></td>
                </tr>
                {/* Truck driver section */}
                <tr>
                  <td className={cell + ' font-bold'}>EXPECTED LITRES</td>
                  <td className={cellR}>{fmt(t.expectedLitres)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>ACTUAL LITRES RECEIVED</td>
                  <td className={cellR}>{fmt(t.actualLitresReceived)}</td>
                </tr>
                <tr>
                  <td className={cell + ' font-bold'}>OVERAGE/(SHORTAGE) - TRUCK DRIVER</td>
                  <td className={cellR}>{fmtOvsh(t.truckDriverOvsh)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}

function ConsumptionReport({ report, startDate, endDate }) {
  const { consumptionReport, fuelTypes } = report
  const [activeFuel, setActiveFuel] = useState(fuelTypes?.[0] || 'PMS')

  if (!consumptionReport) return null

  // fmtDate imported from @/lib/formatDate

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const cell = `border ${REPORT_LINE} px-2 py-1 text-sm`
  const cellR = cell + ' text-right'

  const data = consumptionReport[activeFuel]
  if (!data) return null

  const { customers, rows, totals } = data

  return (
    <div>
      {/* Fuel type tabs */}
      <div className="flex gap-1 mb-4">
        {fuelTypes.map(ft => (
          <button
            key={ft}
            onClick={() => setActiveFuel(ft)}
            className={`px-4 py-1.5 text-sm font-medium border ${
              activeFuel === ft
                ? 'bg-primary-500 text-white border-blue-600'
                : 'bg-surface text-primary-900 dark:text-primary-100 border-primary-500/40 hover:bg-primary-50 dark:hover:bg-primary-950/40'
            }`}
          >
            {ft}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-primary-500/40 text-sm">
          <thead>
            <tr className={hdr}>
              <th className={cell + ' text-left'}>Date</th>
              <th className={cellR}>Rate (N)</th>
              {customers.map(c => (
                <th key={c.id} className={cellR}>{c.name}</th>
              ))}
              <th className={cellR}>Pour back</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const hasAnyValue = row.hasData || customers.some(c => row.customerQtys[c.id]) || row.pourBack
              return (
                <tr key={row.date} className={hasAnyValue ? '' : 'text-content-faint'}>
                  <td className={`${cellR} whitespace-nowrap`}>
                    {fmtDate(row.date)}
                  </td>
                  <td className={cellR}>{fmt(row.rate)}</td>
                  {customers.map(c => (
                    <td key={c.id} className={cellR}>
                      {row.customerQtys[c.id] ? fmt(row.customerQtys[c.id]) : '0'}
                    </td>
                  ))}
                  <td className={cellR}>{row.pourBack ? fmt(row.pourBack) : '0'}</td>
                </tr>
              )
            })}
            {/* Totals row */}
            <tr className={`${subHdr} font-bold`}>
              <td className={cell}>Total</td>
              <td className={cellR}></td>
              {customers.map(c => (
                <td key={c.id} className={cellR}>{fmt(totals.customerTotals[c.id])}</td>
              ))}
              <td className={cellR}>{fmt(totals.pourBack)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {customers.length === 0 && (
        <p className="text-sm text-content-faint text-center py-8">
          No consumption entries for {activeFuel} in this period.
        </p>
      )}
    </div>
  )
}

// ─── Calculator helpers ───

function VarianceBadge({ actual, estimate }) {
  const diff = estimate - actual
  if (diff === 0) return null
  return (
    <span className={`text-xs font-medium ${diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {diff > 0 ? '+' : ''}{fmt(diff)}
    </span>
  )
}

function CalcRow({ label, actual, estimate, editable, onChange }) {
  return (
    <div className="border-b border-line py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-content-muted font-medium">{label}</span>
        <VarianceBadge actual={actual} estimate={estimate} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-subtle px-2.5 py-1.5">
          <span className="text-[10px] text-content-faint uppercase">Actual</span>
          <p className="text-sm font-medium text-content">{fmt(actual)}</p>
        </div>
        {editable ? (
          <div className="bg-yellow-50 dark:bg-yellow-950/40 px-2.5 py-0.5">
            <span className="text-[10px] text-content-faint uppercase">Estimate</span>
            <input
              type="number"
              value={estimate}
              onChange={(e) => onChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              step="0.01"
              className="w-full text-sm font-medium text-content bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        ) : (
          <div className="bg-subtle px-2.5 py-1.5">
            <span className="text-[10px] text-content-faint uppercase">Estimate</span>
            <p className="text-sm font-medium text-content">{fmt(estimate)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Calculator sub-report ───

function CalculatorReport({ report, startDate, endDate }) {
  const { salesCash, stockPosition, fuelTypes } = report

  // Build initial actual values from report data
  const initFuelValues = () => {
    if (!salesCash || !stockPosition) return {}
    const vals = {}
    for (const ft of (fuelTypes || [])) {
      const summary = salesCash.fuelSummaries[ft] || {}
      const sp = stockPosition[ft]?.totals || {}
      vals[ft] = {
        dispensed: summary.totalDispensed || 0,
        consumption: summary.totalConsumedQty || 0,
        pourBack: summary.totalPourBackQty || 0,
        openingStock: sp.opening || 0,
        closingStock: sp.closing || 0,
      }
    }
    return vals
  }

  const initOtherValues = () => ({
    bankDeposit: salesCash?.cashReconciliation?.totalLodgement || 0,
  })

  const [fuelEstimates, setFuelEstimates] = useState(initFuelValues)
  const [otherEstimates, setOtherEstimates] = useState(initOtherValues)

  // Reset estimates when report regenerates
  const reportKey = `${startDate}-${endDate}-${(fuelTypes || []).join(',')}`
  const prevKeyRef = useRef(reportKey)
  useEffect(() => {
    if (prevKeyRef.current !== reportKey) {
      setFuelEstimates(initFuelValues())
      setOtherEstimates(initOtherValues())
      prevKeyRef.current = reportKey
    }
  }, [reportKey])

  if (!salesCash || !stockPosition) return null

  const formatDate = fmtDate

  const updateFuelEstimate = (ft, field, value) => {
    setFuelEstimates(prev => ({
      ...prev,
      [ft]: { ...prev[ft], [field]: Number(value) || 0 }
    }))
  }

  const updateOtherEstimate = (field, value) => {
    setOtherEstimates(prev => ({ ...prev, [field]: Number(value) || 0 }))
  }

  return (
    <div className="pb-4 max-w-lg mx-auto">
      <h2 className="text-base font-bold text-content mb-0.5">
        Calculator — {formatDate(startDate)} to {formatDate(endDate)}
      </h2>
      <p className="text-xs text-content-faint mb-4">
        Yellow fields are editable. Resets on next generation.
      </p>

      {fuelTypes.map(ft => {
        const summary = salesCash.fuelSummaries[ft] || {}
        const sp = stockPosition[ft]?.totals || {}
        const est = fuelEstimates[ft] || {}

        const actualProductSupplied = sp.supply || 0
        const actualProductReceived = sp.actualLitresReceived || 0
        const actualDriverOvSh = sp.truckDriverOvsh || 0
        const actualActualSales = summary.expectedSalesQty || 0
        const actualStockOvSh = sp.actualOvsh || 0

        const estActualSales = est.dispensed - est.consumption - est.pourBack
        const estExpectedClosing = est.openingStock + actualProductSupplied - estActualSales
        const estStockOvSh = est.closingStock - estExpectedClosing

        const actuals = {
          dispensed: summary.totalDispensed || 0,
          consumption: summary.totalConsumedQty || 0,
          pourBack: summary.totalPourBackQty || 0,
          openingStock: sp.opening || 0,
          closingStock: sp.closing || 0,
        }

        const rows = [
          { label: 'Dispensed (litres)', field: 'dispensed', editable: true },
          { label: 'Consumption', field: 'consumption', editable: true },
          { label: 'Pour Back', field: 'pourBack', editable: true },
          { label: 'Opening Stock', field: 'openingStock', editable: true },
          { label: 'Product Supplied', actual: actualProductSupplied, estimate: actualProductSupplied },
          { label: 'Product Received', actual: actualProductReceived, estimate: actualProductReceived },
          { label: 'Driver OV/SH', actual: actualDriverOvSh, estimate: actualDriverOvSh },
          { label: 'Closing Stock', field: 'closingStock', editable: true },
          { label: 'Actual Sales (Disp − Cons − PB)', actual: actualActualSales, estimate: estActualSales },
          { label: 'Stock OV/SH', actual: actualStockOvSh, estimate: estStockOvSh },
        ]

        return (
          <div key={ft} className="mb-5">
            <div className={`px-3 py-1.5 text-sm font-bold ${REPORT_HEAD}`}>{ft}</div>
            <div className={`border border-t-0 ${REPORT_LINE} px-3`}>
              {rows.map((row, i) => {
                const actual = row.field ? actuals[row.field] : row.actual
                const estimate = row.field ? (est[row.field] || 0) : row.estimate
                return (
                  <CalcRow
                    key={i}
                    label={row.label}
                    actual={actual}
                    estimate={estimate}
                    editable={row.editable}
                    onChange={row.editable ? (v) => updateFuelEstimate(ft, row.field, v) : undefined}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Cash / Lodgement section */}
      <div className="mb-5">
        <div className={`px-3 py-1.5 text-sm font-bold ${REPORT_HEAD}`}>Cash / Lodgement</div>
        <div className={`border border-t-0 ${REPORT_LINE} px-3`}>
          {(() => {
            const cr = salesCash.cashReconciliation || {}
            const actualBankDeposit = cr.totalLodgement || 0
            const actualPosTransfer = (cr.totalPOS || 0) + (cr.totalTransfer || 0)
            const actualExpectedSales = cr.expectedSalesTotal || 0
            const actualBalance = cr.overshort || 0
            const estBalance = -(actualExpectedSales - otherEstimates.bankDeposit - actualPosTransfer)

            const rows = [
              { label: 'Bank Deposit', actual: actualBankDeposit, estimate: otherEstimates.bankDeposit, editable: true, field: 'bankDeposit' },
              { label: 'Total POS + Transfer', actual: actualPosTransfer, estimate: actualPosTransfer },
              { label: 'Balance (Overage/Shortage)', actual: actualBalance, estimate: estBalance },
            ]

            return rows.map((row, i) => (
              <CalcRow
                key={i}
                label={row.label}
                actual={row.actual}
                estimate={row.estimate}
                editable={row.editable}
                onChange={row.editable ? (v) => updateOtherEstimate(row.field, v) : undefined}
              />
            ))
          })()}
        </div>
      </div>
    </div>
  )
}

// ─── Product Received sub-report ───

const PRODUCT_FUEL_ORDER = ['PMS', 'AGO', 'DPK']

function ProductReceived({ receipts, tanks, startDate, endDate }) {
  const tankFuel = useMemo(() => {
    const map = {}
    for (const t of (tanks || [])) map[t.id] = t.fuel_type
    return map
  }, [tanks])

  const fuelTypes = useMemo(() => {
    const present = new Set((tanks || []).map(t => t.fuel_type))
    return PRODUCT_FUEL_ORDER.filter(ft => present.has(ft))
  }, [tanks])

  const deliveries = useMemo(() => {
    const rangeReceipts = (receipts || [])
      .filter(r => (r.entryDate || '') >= startDate && (r.entryDate || '') <= endDate)
      .sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

    // Group into deliveries (one per truck, not per tank)
    const deliveryMap = {}
    for (const r of rangeReceipts) {
      const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(s => s || '')
      const key = parts.some(Boolean) ? `${r.entryDate}|${parts.join('|')}` : r.id
      if (!deliveryMap[key]) deliveryMap[key] = { first: r, records: [] }
      deliveryMap[key].records.push(r)
    }

    const rows = Object.values(deliveryMap).map(({ first, records }) => {
      const expected = Number(first.highVol1 ?? first.firstCompartment ?? 0) + Number(first.highVol2 ?? first.secondCompartment ?? 0) + Number(first.highVol3 ?? first.thirdCompartment ?? 0)
      const byFuel = {}
      for (const r of records) {
        const ft = tankFuel[r.tankId]
        if (!ft) continue
        if (!byFuel[ft]) byFuel[ft] = { expected: 0, actual: 0 }
        byFuel[ft].actual += Number(r.actualVolume || 0)
      }
      const fts = Object.keys(byFuel)
      if (fts.length === 1) {
        byFuel[fts[0]].expected = expected
      } else if (fts.length > 1) {
        const totalActual = fts.reduce((s, ft) => s + byFuel[ft].actual, 0)
        for (const ft of fts) {
          byFuel[ft].expected = totalActual > 0 ? Math.round(expected * byFuel[ft].actual / totalActual) : 0
        }
      }
      return { entryDate: first.entryDate, loadedDate: first.loadedDate || '', byFuel }
    })

    rows.sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || ''))

    // Totals
    const totals = {}
    for (const ft of PRODUCT_FUEL_ORDER) totals[ft] = { expected: 0, actual: 0 }
    for (const row of rows) {
      for (const ft of PRODUCT_FUEL_ORDER) {
        totals[ft].expected += row.byFuel[ft]?.expected || 0
        totals[ft].actual += row.byFuel[ft]?.actual || 0
      }
    }

    return { rows, totals }
  }, [receipts, tankFuel, startDate, endDate])

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-1.5 py-1 whitespace-nowrap`
  const cellR = `${cell} text-right`

  return (
    <div className="min-w-[700px] pb-4">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={2 + fuelTypes.length * 2} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              PRODUCT RECEIVED FOR THE MONTH
            </th>
          </tr>
          <tr className={subHdr}>
            <th className={`${cell} font-bold`}>Loading Date</th>
            <th className={`${cell} font-bold`}>Receipt Date</th>
            {fuelTypes.map(ft => (
              <th key={ft} colSpan={2} className={`${cell} text-center font-bold`}>{ft}</th>
            ))}
          </tr>
          <tr className={subHdr}>
            <th className={cell}></th>
            <th className={cell}></th>
            {fuelTypes.map(ft => (
              <Fragment key={ft}>
                <th className={`${cellR} font-bold text-xs`}>Expected</th>
                <th className={`${cellR} font-bold text-xs`}>Actual</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {deliveries.rows.length === 0 ? (
            <tr>
              <td colSpan={2 + fuelTypes.length * 2} className={`${cell} text-center text-content-faint py-8`}>
                No product receipts found in this period.
              </td>
            </tr>
          ) : (
            deliveries.rows.map((row, i) => (
              <tr key={i} className="hover:bg-primary-50/40">
                <td className={`${cellR}`}>{row.loadedDate ? fmtDate(row.loadedDate) : '—'}</td>
                <td className={`${cellR}`}>{row.entryDate ? fmtDate(row.entryDate) : '—'}</td>
                {fuelTypes.map(ft => (
                  <Fragment key={ft}>
                    <td className={cellR}>{row.byFuel[ft]?.expected ? fmt(row.byFuel[ft].expected) : ''}</td>
                    <td className={cellR}>{row.byFuel[ft]?.actual ? fmt(row.byFuel[ft].actual) : ''}</td>
                  </Fragment>
                ))}
              </tr>
            ))
          )}
          {deliveries.rows.length > 0 && (
            <tr className={`${subHdr} font-bold`}>
              <td className={cell} colSpan={2}>Total</td>
              {fuelTypes.map(ft => (
                <Fragment key={ft}>
                  <td className={cellR}>{fmt(deliveries.totals[ft].expected)}</td>
                  <td className={cellR}>{fmt(deliveries.totals[ft].actual)}</td>
                </Fragment>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
