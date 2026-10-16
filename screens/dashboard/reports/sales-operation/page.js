'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { db } from '@/lib/db'
import { buildSalesOperationReport } from '@/lib/buildSalesOperationReport'
import { exportSalesOperationExcel } from '@/lib/exportSalesOperationExcel'
import DateRange from '@/components/reports/DateRange'
import AccessGate from '@/components/AccessGate'

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
      }).catch(() => {})
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
      await exportSalesOperationExcel({
        report,
        stationName,
        startDate: reportStart,
        endDate: reportEnd,
      })
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

  const activeSheet = report?.sheets.find(s => s.sheetName === activeSheetName) || null

  return (
    <AccessGate orgId={orgId} pageKey="report-sales-operation">
      {({ isOwner }) => (
        <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
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

          {!generated ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-content-faint text-sm">Select a date range and click Generate.</p>
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
            <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 border border-line">
              <SalesOperationGrid sheet={activeSheet} stationName={stationName} />
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

/**
 * Single 11-column grid replicating the August 2023 Lucky Way reference exactly.
 * Stubbed sections use the reference's placeholder values to keep visual parity.
 */
function SalesOperationGrid({ sheet, stationName }) {
  const fuelByType = Object.fromEntries(sheet.fuel.map(f => [f.fuelType, f]))
  const stockByType = Object.fromEntries(sheet.stock.map(s => [s.fuelType, s]))
  const deposits = sheet.bankRows.deposits
  const pos = sheet.bankRows.pos
  const cash = sheet.cash
  const lubeItems = sheet.lube || []
  const lubeAmount = lubeItems.reduce((s, l) => s + (l.amount || 0), 0)

  // Palette matched to the August 2023 reference (inspected from .xlsx)
  const cell = 'border border-black px-2 py-1 align-middle'
  const cellL = `${cell} text-left`
  const cellC = `${cell} text-center`
  const cellR = `${cell} text-right`
  const label = 'bg-[#B4C6E7] font-bold'      // label cells (Station, Date only)
  const colHdr = 'bg-[#F4B083] font-bold'      // orange column headers
  const section = 'bg-[#BDD6EE] font-bold'     // section title rows + blank separators
  const fuelLbl = 'bg-[#C5E0B3]'               // green — entire col A from R4 to R38
  const yellow = 'bg-[#FFFF00]'                // total/output formula cells
  const gray = 'bg-[#D8D8D8]'                  // merged blank blocks (B8:J8, H10:K13)
  const labelCell = `${cellL} ${label}`
  const fuelCell = `${cellC} ${fuelLbl}`
  const fuelLeft = `${cellL} ${fuelLbl} font-bold`

  const BUDGET = { PMS: 14400, AGO: 480, DPK: 240 }
  const COMP = {
    PMS: { rainoil: 537, c1: 'PRIME',  p1: 6,     c2: 'NNPC', p2: 511, c3: 'YOZIDDA', p3: 511, c4: 'NASKO', p4: 505 },
    AGO: { rainoil: 650, c1: 'Conoil', p1: 650,   c2: 'NNPC', p2: 670, c3: 'YOZIDDA', p3: 680, c4: 'NASKO', p4: 680 },
    DPK: { rainoil: 700, c1: 'PRIME',  p1: 'NIL', c2: 'NNPC', p2: 0,   c3: 'YOZZIDA', p3: 0,   c4: 'NASKO', p4: 'NIL' },
  }

  // Helper: produce a fuel data row (R5/R6/R7)
  const fuelRow = (ft) => {
    const f = fuelByType[ft] || {}
    return (
      <tr key={`fuel-${ft}`}>
        <td className={fuelCell}>{ft}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.price1)}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.actualSalesP1)}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.rttP1)}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.consP1)}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.price2)}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.actualSalesP2)}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.rttP2)}</td>
        <td className={`${cellC} font-bold`}>{fmt(f.consP2)}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(f.totalActualLtrs)}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(f.amount)}</td>
      </tr>
    )
  }

  // Helper: produce a stock data row (R11/R12/R13)
  const stockRow = (ft) => {
    const s = stockByType[ft] || {}
    const truckShortage = (s.actualReceived || 0) - (s.waybill || 0)
    return (
      <tr key={`stock-${ft}`}>
        <td className={fuelCell}>{ft}</td>
        <td className={`${cellC} font-bold`}>{fmt(s.opening)}</td>
        <td className={`${cellC} font-bold`}>{fmt(s.waybill)}</td>
        <td className={`${cellC} font-bold`}>{fmt(s.actualReceived)}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(truckShortage)}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(s.totalDispensed)}</td>
        <td className={`${cellC} font-bold`}>{fmt(s.closing)}</td>
        {/* H:K covered by R10's rowSpan=4 colSpan=4 merged cell */}
      </tr>
    )
  }

  // Helper: produce a recon row (R16/R17/R18)
  const reconRow = (ft) => {
    const s = stockByType[ft] || {}
    const f = fuelByType[ft] || {}
    const expectedOverage = ((s.opening || 0) + (s.waybill || 0) - (s.closing || 0)) * 0.01
    const actualOverage = (s.totalDispensed || 0) - ((s.opening || 0) + (s.waybill || 0) - (s.closing || 0)) - ((f.rttP1 || 0) + (f.rttP2 || 0))
    const variance = actualOverage - expectedOverage
    const msg = variance > 0
      ? 'Liquid height variation on the Positive side'
      : 'Liquid height variation on the Negative side'
    return (
      <tr key={`recon-${ft}`}>
        <td className={fuelCell}>{ft}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(Math.round(expectedOverage))}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(Math.round(actualOverage))}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(Math.round(variance))}</td>
        <td className={cellL} colSpan={7}>{msg}</td>
      </tr>
    )
  }

  // Helper: budget row (R28/R29/R30) — placeholders
  const budgetRow = (ft) => {
    const f = fuelByType[ft] || {}
    const budget = BUDGET[ft]
    const total = f.totalActualLtrs || 0
    const achievement = budget ? total / budget : 0
    const variance = total - budget
    const comment = variance < 0 ? 'Low Demand' : 'High Demand'
    return (
      <tr key={`budget-${ft}`}>
        <td className={fuelCell}>{ft}</td>
        <td className={`${cellC} font-bold`}>{fmt(budget)}</td>
        <td className={`${cellC} font-bold ${yellow}`}>{(achievement * 100).toFixed(1)}%</td>
        <td className={`${cellC} font-bold ${yellow}`}>{fmt(variance)}</td>
        <td className={cellC} colSpan={7}>{comment}</td>
      </tr>
    )
  }

  // Helper: competitor row (R34/R35/R36) — placeholders
  const compRow = (ft) => {
    const c = COMP[ft]
    return (
      <tr key={`comp-${ft}`}>
        <td className={fuelCell}>{ft}</td>
        <td className={`${cellC} font-bold`}>{fmt(c.rainoil)}</td>
        <td className={cellC}>{c.c1}</td>
        <td className={`${cellC} font-bold`}>{typeof c.p1 === 'number' ? fmt(c.p1) : c.p1}</td>
        <td className={cellC}>{c.c2}</td>
        <td className={`${cellC} font-bold`}>{fmt(c.p2)}</td>
        <td className={cellC}>{c.c3}</td>
        <td className={`${cellC} font-bold`}>{fmt(c.p3)}</td>
        <td className={cellC}>{c.c4}</td>
        <td className={`${cellC} font-bold`}>{typeof c.p4 === 'number' ? fmt(c.p4) : c.p4}</td>
        <td className={cell}></td>
      </tr>
    )
  }

  // Lube total
  const lubeTotals = lubeItems.reduce((a, i) => ({
    opening: a.opening + (i.openingStock || 0),
    supply:  a.supply  + (i.productSupply || 0),
    sales:   a.sales   + (i.sales || 0),
    closing: a.closing + (i.closingStock || 0),
    amount:  a.amount  + (i.amount || 0),
    variance:a.variance+ (i.variance || 0),
  }), { opening: 0, supply: 0, sales: 0, closing: 0, amount: 0, variance: 0 })

  return (
    <table className="border-collapse text-xs min-w-[1100px]" style={{ fontFamily: 'Corbel, Calibri, sans-serif' }}>
      <colgroup>
        <col style={{ width: 140 }} />
        <col style={{ width: 90 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 75 }} />
        <col style={{ width: 75 }} />
        <col style={{ width: 90 }} />
        <col style={{ width: 110 }} />
        <col style={{ width: 75 }} />
        <col style={{ width: 75 }} />
        <col style={{ width: 120 }} />
        <col style={{ width: 100 }} />
      </colgroup>
      <tbody>
        {/* R1: Station (A1:A2 vertical merge via rowSpan, #REF! to match reference) */}
        <tr>
          <td className={`${cellC} ${label}`} rowSpan={2}>#REF!</td>
          <td className={labelCell}>Station</td>
          <td className={`${cellC} font-bold`} colSpan={9}>{stationName || ''}</td>
        </tr>

        {/* R2: Date + Times */}
        <tr>
          <td className={labelCell}>Date</td>
          <td className={cellL} colSpan={3}>{sheet.date}</td>
          <td className={labelCell}>Opening Time</td>
          <td className={cellL} colSpan={2}>6;00am</td>
          <td className={labelCell}>Closing Time</td>
          <td className={cellL} colSpan={2}>9;00pm</td>
        </tr>

        {/* R3: blank separator (section blue) */}
        <tr><td colSpan={11} className={`${cell} ${section} h-3`}></td></tr>

        {/* R4: Fuel headers (col A green) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          <td className={`${cellC} ${colHdr}`}>Price 1</td>
          <td className={`${cellC} ${colHdr}`}>Actual Sales @P1</td>
          <td className={`${cellC} ${colHdr}`}>RTT @P1</td>
          <td className={`${cellC} ${colHdr}`}>Cons. @P1</td>
          <td className={`${cellC} ${colHdr}`}>Price 2</td>
          <td className={`${cellC} ${colHdr}`}>Actual Sales @P2</td>
          <td className={`${cellC} ${colHdr}`}>RTT @P2</td>
          <td className={`${cellC} ${colHdr}`}>Cons. @P2</td>
          <td className={`${cellC} ${colHdr}`}>Total Actual Sales (Ltrs)</td>
          <td className={`${cellC} ${colHdr}`}>Amount (N)</td>
        </tr>

        {/* R5–R7: PMS/AGO/DPK */}
        {fuelRow('PMS')}
        {fuelRow('AGO')}
        {fuelRow('DPK')}

        {/* R8: LUBES (B:J merged with gray fill) */}
        <tr>
          <td className={fuelCell}>LUBES</td>
          <td className={`${cell} ${gray}`} colSpan={9}></td>
          <td className={`${cellC} font-bold ${yellow}`}>{fmt(lubeAmount)}</td>
        </tr>

        {/* R9: STOCK INVENTORY title */}
        <tr><td colSpan={11} className={`${cellL} ${section}`}>STOCK INVENTORY (LITRES)</td></tr>

        {/* R10: stock headers (col A green; H:K merged with R11-R13 as gray block) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          <td className={`${cellC} ${colHdr}`}>Opening stock</td>
          <td className={`${cellC} ${colHdr}`}>Waybill Qty Supplied</td>
          <td className={`${cellC} ${colHdr}`}>Actual Qty Received</td>
          <td className={`${cellC} ${colHdr}`}>Truck Shortage</td>
          <td className={`${cellC} ${colHdr}`}>Total Dispensed</td>
          <td className={`${cellC} ${colHdr}`}>Closing stock</td>
          <td className={`${cell} ${gray}`} rowSpan={4} colSpan={4}></td>
        </tr>

        {/* R11–R13 */}
        {stockRow('PMS')}
        {stockRow('AGO')}
        {stockRow('DPK')}

        {/* R14: STOCK RECONCILIATION title */}
        <tr><td colSpan={11} className={`${cellL} ${section}`}>STOCK RECONCILIATION (Litres)</td></tr>

        {/* R15: recon headers (col A green; E:K merged white) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          <td className={`${cellC} ${colHdr}`}>Expected Overage</td>
          <td className={`${cellC} ${colHdr}`}>Actual Overage</td>
          <td className={`${cellC} ${colHdr}`}>Variance</td>
          <td className={cell} colSpan={7}></td>
        </tr>

        {/* R16–R18 */}
        {reconRow('PMS')}
        {reconRow('AGO')}
        {reconRow('DPK')}

        {/* R19: blank (section blue) */}
        <tr><td colSpan={11} className={`${cell} ${section} h-3`}></td></tr>

        {/* R20: deposit + POS headers (col A green) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          {['Deposit 1', 'Deposit 2', 'Deposit 3', 'Deposit 4', 'Bank POS 1', 'Bank POS 2', 'Bank POS 3', 'Bank POS 4', 'Bank POS 5', 'Bank POS 6'].map(h => (
            <td key={h} className={`${cellC} ${colHdr}`}>{h}</td>
          ))}
        </tr>

        {/* R21: amounts (col A green) */}
        <tr>
          <td className={fuelLeft}>Amount (₦)</td>
          {[0, 1, 2, 3].map(i => <td key={`d${i}`} className={`${cellC} font-bold`}>{fmt(deposits[i]?.amount)}</td>)}
          {[0, 1, 2, 3, 4, 5].map(i => <td key={`p${i}`} className={`${cellC} font-bold`}>{fmt(pos[i]?.amount)}</td>)}
        </tr>

        {/* R22: bank names (col A green) */}
        <tr>
          <td className={fuelLeft}>Bank</td>
          {[0, 1, 2, 3].map(i => <td key={`db${i}`} className={cellC}>{deposits[i]?.bankName || ''}</td>)}
          {[0, 1, 2, 3, 4, 5].map(i => <td key={`pb${i}`} className={cellC}>{pos[i]?.bankName || ''}</td>)}
        </tr>

        {/* R23: CASH RECON title */}
        <tr><td colSpan={11} className={`${cellL} ${section}`}>CASH RECONCILIATION (₦)</td></tr>

        {/* R24: cash recon headers (col A green) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          <td className={`${cellC} ${colHdr}`}>Total Expected Sales</td>
          <td className={`${cellC} ${colHdr}`}>Previous Day Cash @ Hand</td>
          <td className={`${cellC} ${colHdr}`}>Total Bank Deposit</td>
          <td className={`${cellC} ${colHdr}`}>Total POS</td>
          <td className={`${cellC} ${colHdr}`}>Expected Cash @ Hand</td>
          <td className={`${cellC} ${colHdr}`}>Actual Cash @ Hand</td>
          <td className={`${cellC} ${colHdr}`}>Variance in Cash</td>
          <td className={`${cellC} ${colHdr}`} colSpan={3}>Reason for Cash Variance</td>
        </tr>

        {/* R25: cash values (col A green) */}
        <tr>
          <td className={fuelLeft}>Amount (₦)</td>
          <td className={`${cellC} font-bold ${yellow}`}>{fmt(cash.totalExpectedSales)}</td>
          <td className={`${cellC} font-bold`}>{fmt(cash.prevDayCash)}</td>
          <td className={`${cellC} font-bold ${yellow}`}>{fmt(cash.totalBankDeposit)}</td>
          <td className={`${cellC} font-bold ${yellow}`}>{fmt(cash.totalPOS)}</td>
          <td className={`${cellC} font-bold ${yellow}`}>{fmt(cash.expectedCashAtHand)}</td>
          <td className={`${cellC} font-bold`}>{fmt(cash.actualCashAtHand)}</td>
          <td className={`${cellC} font-bold ${yellow}`}>{fmt(cash.variance)}</td>
          <td className={cellL} colSpan={3}>{cash.reason || ''}</td>
        </tr>

        {/* R26: blank (section blue) */}
        <tr><td colSpan={11} className={`${cell} ${section} h-3`}></td></tr>

        {/* R27: budget headers (col A green) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          <td className={`${cellC} ${colHdr}`}>Budget (Ltrs)</td>
          <td className={`${cellC} ${colHdr}`}>Achievement</td>
          <td className={`${cellC} ${colHdr}`}>Variance (Ltrs)</td>
          <td className={`${cellC} ${colHdr}`} colSpan={7}>Comments on Sales Achievement (Issues that Increased or Reduced Sales on this Date)</td>
        </tr>

        {/* R28–R30: budget rows */}
        {budgetRow('PMS')}
        {budgetRow('AGO')}
        {budgetRow('DPK')}

        {/* R31: LUBES budget (placeholder zeros) */}
        <tr>
          <td className={fuelCell}>LUBES</td>
          <td className={`${cellC} font-bold`}>0</td>
          <td className={`${cellC} font-bold ${yellow}`}>0</td>
          <td className={`${cellC} font-bold ${yellow}`}>0</td>
          <td className={cellC} colSpan={7}></td>
        </tr>

        {/* R32: blank (section blue) */}
        <tr><td colSpan={11} className={`${cell} ${section} h-3`}></td></tr>

        {/* R33: competitor headers (col A green) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          <td className={`${cellC} ${colHdr}`}>Rainoil</td>
          <td className={`${cellC} ${colHdr}`}>Competitor 1</td>
          <td className={`${cellC} ${colHdr}`}>Price 1</td>
          <td className={`${cellC} ${colHdr}`}>Competitor 2</td>
          <td className={`${cellC} ${colHdr}`}>Price 2</td>
          <td className={`${cellC} ${colHdr}`}>Competitor 3</td>
          <td className={`${cellC} ${colHdr}`}>Price 3</td>
          <td className={`${cellC} ${colHdr}`}>Competitor 4</td>
          <td className={`${cellC} ${colHdr}`}>Price 4</td>
          <td className={`${cell} ${colHdr}`}></td>
        </tr>

        {/* R34–R36: competitor rows */}
        {compRow('PMS')}
        {compRow('AGO')}
        {compRow('DPK')}

        {/* R37: LUBE BREAKDOWN title */}
        <tr><td colSpan={11} className={`${cellL} ${section}`}>LUBE SALES BREAKDOWN</td></tr>

        {/* R38: lube headers (col A green) */}
        <tr>
          <td className={`${cell} ${fuelLbl}`}></td>
          <td className={`${cell} ${colHdr}`}></td>
          <td className={`${cellC} ${colHdr}`}>Litre</td>
          <td className={`${cellC} ${colHdr}`}>Unit Price</td>
          <td className={`${cellC} ${colHdr}`}>Opening Stock Units</td>
          <td className={`${cellC} ${colHdr}`}>Product Supply Units</td>
          <td className={`${cellC} ${colHdr}`}>Sales Units</td>
          <td className={`${cellC} ${colHdr}`}>Closing Stock Units</td>
          <td className={`${cellC} ${colHdr}`}>Amount (₦)</td>
          <td className={`${cellC} ${colHdr}`}>Variance Units</td>
          <td className={`${cell} ${colHdr}`}></td>
        </tr>

        {/* R39+: lube product rows (A:B merged; Sales/Amount/Variance yellow) */}
        {lubeItems.map((l, i) => (
          <tr key={`lube-${i}`}>
            <td className={cellL} colSpan={2}>{l.productName}</td>
            <td className={`${cellC} font-bold`}>{fmt(l.litre)}</td>
            <td className={`${cellC} font-bold`}>{fmt(l.unitPrice)}</td>
            <td className={`${cellC} font-bold`}>{fmt(l.openingStock)}</td>
            <td className={`${cellC} font-bold`}>{fmt(l.productSupply)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(l.sales)}</td>
            <td className={`${cellC} font-bold`}>{fmt(l.closingStock)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(l.amount)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(l.variance)}</td>
            <td className={cell}></td>
          </tr>
        ))}

        {lubeItems.length > 0 && (
          <tr>
            <td className={`${cellL} ${yellow} font-bold`} colSpan={2}>TOTAL</td>
            <td className={`${cell} ${yellow}`}></td>
            <td className={`${cell} ${yellow}`}></td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(lubeTotals.opening)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(lubeTotals.supply)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(lubeTotals.sales)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(lubeTotals.closing)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(lubeTotals.amount)}</td>
            <td className={`${cellC} font-bold ${yellow}`}>{fmt(lubeTotals.variance)}</td>
            <td className={`${cell} ${yellow}`}></td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
