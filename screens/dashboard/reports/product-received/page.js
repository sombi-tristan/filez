'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import Link from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, Calculator, Download } from 'lucide-react'
import { db } from '@/lib/db'
import { exportProductReceiptExcel } from '@/lib/exportProductReceiptExcel'
import { exportProductReceiptGenericExcel } from '@/lib/exportProductReceiptGenericExcel'
import { isRainoilGroup } from '@/lib/exportGroup'
import DateRange from '@/components/reports/DateRange'
import { defaultReportStart, exportAllowed } from '@/lib/reportRange'
import { useLicence, PaidNote } from '@/components/desktop/LicenceGate'
import AccessGate from '@/components/AccessGate'
import { fmtDate } from '@/lib/formatDate'
import { REPORT_HEAD, REPORT_LINE, OUTLINE_WITHIN, BTN_FRAMED, BTN_PRIMARY, REPORT_CARD } from '@/components/ui'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function ProductReceivedReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <ProductReceivedReportContent />
    </Suspense>
  )
}

/**
 * Group raw product receipt records (one per tank) into deliveries.
 * Same grouping logic as the entry form.
 */
function groupIntoDeliveries(records, tanksMap) {
  const groups = {}
  for (const r of records) {
    const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(s => s || '')
    const key = parts.some(Boolean) ? parts.join('|') : r.id
    if (!groups[key]) groups[key] = { records: [], first: r }
    groups[key].records.push(r)
  }

  return Object.values(groups).map(({ records: recs, first }) => {
    const qtyLoaded = (Number(first.highVol1) || Number(first.firstCompartment) || 0) +
      (Number(first.highVol2) || Number(first.secondCompartment) || 0) +
      (Number(first.highVol3) || Number(first.thirdCompartment) || 0)
    const qtySupplied = recs.reduce((sum, r) => sum + (Number(r.actualVolume) || 0), 0)

    // Collect fuel types from tanks
    const fuelTypes = []
    for (const r of recs) {
      const tank = tanksMap[r.tankId]
      const ft = tank ? tank.fuel_type : null
      if (ft && !fuelTypes.includes(ft)) fuelTypes.push(ft)
    }

    return {
      dischargeDate: first.entryDate || '',
      loadingDate: first.loadedDate || '',
      product: fuelTypes.join(', ') || '—',
      qtyLoaded,
      qtySupplied,
      driverName: first.driverName || '',
      truckNumber: first.truckNumber || '',
      ticketNumber: first.ticketNumber || '',
      waybillNumber: first.waybillNumber || '',
      shortage: qtyLoaded - qtySupplied,
      depot: first.depotName || '',
      // Fields needed for Excel export
      arrivalTime: first.arrivalTime || '',
      exitTime: first.exitTime || '',
      chartHighUllage1: first.chartHighUllage1 ?? first.chartUllage1 ?? first.chartUllage ?? 0,
      chartHighUllage2: first.chartHighUllage2 ?? first.chartUllage2 ?? 0,
      chartHighUllage3: first.chartHighUllage3 ?? first.chartUllage3 ?? 0,
      chartLowUllage1: first.chartLowUllage1 ?? 0,
      chartLowUllage2: first.chartLowUllage2 ?? 0,
      chartLowUllage3: first.chartLowUllage3 ?? 0,
      chartLiquidHeight1: first.chartLiquidHeight1 ?? first.chartLiquidHeight ?? 0,
      chartLiquidHeight2: first.chartLiquidHeight2 ?? 0,
      chartLiquidHeight3: first.chartLiquidHeight3 ?? 0,
      stationUllage1: first.stationUllage1 ?? first.stationUllage ?? 0,
      stationUllage2: first.stationUllage2 ?? 0,
      stationUllage3: first.stationUllage3 ?? 0,
      stationLiquidHeight1: first.stationLiquidHeight1 ?? first.stationLiquidHeight ?? 0,
      stationLiquidHeight2: first.stationLiquidHeight2 ?? 0,
      stationLiquidHeight3: first.stationLiquidHeight3 ?? 0,
      depotUllage1: first.depotUllage1 ?? first.depotUllage ?? 0,
      depotUllage2: first.depotUllage2 ?? 0,
      depotUllage3: first.depotUllage3 ?? 0,
      depotLiquidHeight1: first.depotLiquidHeight1 ?? first.depotLiquidHeight ?? 0,
      depotLiquidHeight2: first.depotLiquidHeight2 ?? 0,
      depotLiquidHeight3: first.depotLiquidHeight3 ?? 0,
      highVol1: first.highVol1 ?? first.firstCompartment ?? 0,
      highVol2: first.highVol2 ?? first.secondCompartment ?? 0,
      highVol3: first.highVol3 ?? first.thirdCompartment ?? 0,
      lowVol1: first.lowVol1 ?? 0,
      lowVol2: first.lowVol2 ?? 0,
      lowVol3: first.lowVol3 ?? 0,
    }
  })
}

function ProductReceivedReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  // Desktop build: the month to date, or the last 5 days without a subscription (lib/reportRange.js).
  const monthStartStr = defaultReportStart(todayStr, `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`)
  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [generated, setGenerated] = useState(true)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  const [exportingIdx, setExportingIdx] = useState(null)
  // Exporting is a paid feature: without a subscription the button shows PaidNote instead.
  const paid = Boolean(useLicence()?.paid)
  const [askedToExport, setAskedToExport] = useState(false)

  // Config
  const [tanks, setTanks] = useState([])
  // Selects the export format, via isRainoilGroup in lib/exportGroup. This page never needed
  // the station before, so this is the only reason it is fetched.
  const [stationGroup, setStationGroup] = useState('')

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    fetch(`/api/organizations?org_id=${encodeURIComponent(orgId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const match = (data?.stations || [])[0]
        if (match) setStationGroup(match.station_group || '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [orgId])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      const tnk = await db.tanks.where('orgId').equals(orgId).toArray()
      setTanks(tnk)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  // Live query
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  // Tank lookup
  const tanksMap = useMemo(() => {
    return Object.fromEntries(tanks.map(t => [t.id, t]))
  }, [tanks])

  // Derive report
  const deliveries = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !liveReceipts) return null

    // Filter to date range
    const filtered = liveReceipts.filter(r => {
      const d = r.entryDate || ''
      return d >= reportStart && d <= reportEnd
    })

    // Sort by discharge date descending (newest first)
    filtered.sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))

    const grouped = groupIntoDeliveries(filtered, tanksMap)

    // Compute totals
    let totalLoaded = 0, totalSupplied = 0, totalShortage = 0
    for (const d of grouped) {
      totalLoaded += d.qtyLoaded
      totalSupplied += d.qtySupplied
      totalShortage += d.shortage
    }

    return { rows: grouped, totalLoaded, totalSupplied, totalShortage }
  }, [generated, reportStart, reportEnd, loading, orgId, liveReceipts, tanksMap])

  const handleExport = async (row, idx) => {
    if (exportingIdx !== null) return
    if (!exportAllowed()) { setAskedToExport(true); return }
    setExportingIdx(idx)
    try {
      // exportProductReceiptExcel is a replica of Rainoil's discharge certificate, theirs
      // alone. Everyone else gets the plain sheet, from the same figures.
      const exportFn = isRainoilGroup(stationGroup)
        ? exportProductReceiptExcel
        : exportProductReceiptGenericExcel
      await exportFn({
        product: row.product,
        truckNumber: row.truckNumber,
        driverName: row.driverName,
        depotName: row.depot,
        ticketNumber: row.ticketNumber,
        waybillNumber: row.waybillNumber,
        loadedDate: row.loadingDate,
        entryDate: row.dischargeDate,
        arrivalTime: row.arrivalTime,
        exitTime: row.exitTime,
        chartHighUllage: [row.chartHighUllage1, row.chartHighUllage2, row.chartHighUllage3],
        chartLowUllage: [row.chartLowUllage1, row.chartLowUllage2, row.chartLowUllage3],
        chartLiquidHeight: [row.chartLiquidHeight1, row.chartLiquidHeight2, row.chartLiquidHeight3],
        stationUllage: [row.stationUllage1, row.stationUllage2, row.stationUllage3],
        stationLiquidHeight: [row.stationLiquidHeight1, row.stationLiquidHeight2, row.stationLiquidHeight3],
        depotUllage: [row.depotUllage1, row.depotUllage2, row.depotUllage3],
        depotLiquidHeight: [row.depotLiquidHeight1, row.depotLiquidHeight2, row.depotLiquidHeight3],
        highVol: [row.highVol1, row.highVol2, row.highVol3],
        lowVol: [row.lowVol1, row.lowVol2, row.lowVol3],
        qtyReceived: row.qtySupplied,
      })
    } catch (err) {
      console.error('Excel export failed:', err)
      alert('Export failed: ' + (err?.message || String(err)))
    } finally {
      setExportingIdx(null)
    }
  }

  const handleGenerate = () => {
    if (!startDate || !endDate) return
    setReportStart(startDate)
    setReportEnd(endDate)
    setGenerated(true)
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>
  }

  const hdr = REPORT_HEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-2 py-1 whitespace-nowrap`
  const cellR = `${cell} text-right`

  return (
    <AccessGate orgId={orgId} pageKey="report-product-received">
      {({ isOwner }) => (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Header + date range */}
      <div className="flex items-center justify-between py-3 shrink-0">
        <h1 className="text-lg font-bold text-content">Product Received</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateRange
            start={startDate}
            end={endDate}
            onStart={setStartDate}
            onEnd={setEndDate}
            onGenerate={handleGenerate}
            disabled={!startDate || !endDate || startDate > endDate}
          />
          <Link
            href={`/dashboard/reports/dip-calculator?org_id=${orgId}`}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}
          >
            <Calculator className="w-4 h-4" />
            Dip Calculator
          </Link>
        </div>
      </div>
      {askedToExport && !paid && <div className="mb-3 shrink-0"><PaidNote what="Exporting a report" /></div>}

      {/* Content */}
      <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 pb-4 ${REPORT_CARD}`}>
        {!generated ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-content-faint text-sm">Select a date range and click Generate.</p>
          </div>
        ) : !deliveries ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
          </div>
        ) : deliveries.rows.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-content-faint text-sm">No product receipts found in this date range.</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead>
              <tr>
                <th className={`${cell} ${hdr} text-left`}>Discharge Date</th>
                <th className={`${cell} ${hdr} text-left`}>Loading Date</th>
                <th className={`${cell} ${hdr} text-left`}>Product</th>
                <th className={`${cell} ${hdr} text-right`}>Qty Loaded</th>
                <th className={`${cell} ${hdr} text-right`}>Qty Supplied</th>
                <th className={`${cell} ${hdr} text-left`}>Driver</th>
                <th className={`${cell} ${hdr} text-left`}>Truck No.</th>
                <th className={`${cell} ${hdr} text-left`}>Ticket ID</th>
                <th className={`${cell} ${hdr} text-left`}>Waybill No.</th>
                <th className={`${cell} ${hdr} text-right`}>Shortage</th>
                <th className={`${cell} ${hdr} text-left`}>Depot</th>
                <th className={`${cell} ${hdr} text-center`}></th>
              </tr>
            </thead>
            <tbody>
              {deliveries.rows.map((row, i) => {
                const shortageColor = row.shortage > 0 ? 'text-red-600 dark:text-red-400 font-medium' : row.shortage < 0 ? 'text-green-600 dark:text-green-400 font-medium' : ''
                return (
                  <tr key={i} className="hover:bg-primary-50/40">
                    <td className={`${cellR} whitespace-nowrap`}>{row.dischargeDate ? fmtDate(row.dischargeDate) : '—'}</td>
                    <td className={`${cellR} whitespace-nowrap`}>{row.loadingDate ? fmtDate(row.loadingDate) : '—'}</td>
                    <td className={cell}>{row.product}</td>
                    <td className={cellR}>{fmt(row.qtyLoaded)}</td>
                    <td className={cellR}>{fmt(row.qtySupplied)}</td>
                    <td className={cell}>{row.driverName || '—'}</td>
                    <td className={cell}>{row.truckNumber || '—'}</td>
                    <td className={cell}>{row.ticketNumber || '—'}</td>
                    <td className={cell}>{row.waybillNumber || '—'}</td>
                    <td className={`${cellR} ${shortageColor}`}>{fmt(row.shortage)}</td>
                    <td className={cell}>{row.depot || '—'}</td>
                    <td className={`${cell} text-center`}>
                      <div className="flex items-center justify-center gap-2">
                        {isOwner && (
                        <button
                          onClick={() => handleExport(row, i)}
                          disabled={exportingIdx !== null}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium disabled:opacity-50 ${BTN_FRAMED}`}
                          title="Export Excel"
                        >
                          {exportingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          Export
                        </button>
                        )}
                        <Link
                          href={`/dashboard/reports/dip-calculator?org_id=${orgId}&cU1=${row.chartHighUllage1}&cU2=${row.chartHighUllage2}&cU3=${row.chartHighUllage3}&cL1=${row.chartLiquidHeight1}&cL2=${row.chartLiquidHeight2}&cL3=${row.chartLiquidHeight3}&dU1=${row.depotUllage1}&dU2=${row.depotUllage2}&dU3=${row.depotUllage3}&dL1=${row.depotLiquidHeight1}&dL2=${row.depotLiquidHeight2}&dL3=${row.depotLiquidHeight3}&sU1=${row.stationUllage1}&sU2=${row.stationUllage2}&sU3=${row.stationUllage3}&sL1=${row.stationLiquidHeight1}&sL2=${row.stationLiquidHeight2}&sL3=${row.stationLiquidHeight3}&hV1=${row.highVol1}&hV2=${row.highVol2}&hV3=${row.highVol3}&lV1=${row.lowVol1}&lV2=${row.lowVol2}&lV3=${row.lowVol3}&hU1=${row.chartHighUllage1}&hU2=${row.chartHighUllage2}&hU3=${row.chartHighUllage3}&lU1=${row.chartLowUllage1}&lU2=${row.chartLowUllage2}&lU3=${row.chartLowUllage3}`}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700"
                          title="Dip Calculator"
                        >
                          <Calculator className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-primary-50 dark:bg-primary-950/40">
                <td className={cell} colSpan={3}>Total ({deliveries.rows.length} deliveries)</td>
                <td className={cellR}>{fmt(deliveries.totalLoaded)}</td>
                <td className={cellR}>{fmt(deliveries.totalSupplied)}</td>
                <td className={cell} colSpan={4}></td>
                <td className={`${cellR} ${deliveries.totalShortage > 0 ? 'text-red-600 dark:text-red-400' : deliveries.totalShortage < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                  {fmt(deliveries.totalShortage)}
                </td>
                <td className={cell}></td>
                <td className={cell}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
      )}
    </AccessGate>
  )
}

