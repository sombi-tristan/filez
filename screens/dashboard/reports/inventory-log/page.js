'use client'

import { Suspense, useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { buildInventoryLogReport } from '@/lib/buildInventoryLogReport'
import { fmtDate } from '@/lib/formatDate'
import DateRange from '@/components/reports/DateRange'
import AccessGate from '@/components/AccessGate'
import { REPORT_HEAD, REPORT_SUBHEAD, REPORT_LINE, OUTLINE_WITHIN, BTN_PRIMARY, REPORT_CARD } from '@/components/ui'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtSigned(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  if (v === 0) return '0'
  if (v < 0) return `(${fmt(Math.abs(v))})`
  return fmt(v)
}

export default function InventoryLogPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <InventoryLogContent />
    </Suspense>
  )
}

function InventoryLogContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])

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

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      const [noz, tnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
      ])
      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setNozzles(noz)
      setTanks(tnk)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  const liveSales = useLiveQuery(
    () => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )
  const liveReceipts = useLiveQuery(
    () => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const ms = new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')
    return Math.floor(ms / 86400000) + 1
  }, [startDate, endDate])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts) return null
    return buildInventoryLogReport({
      sales: liveSales,
      receipts: liveReceipts,
      nozzles,
      tanks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, liveSales, liveReceipts])

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
      setGenerating(false)
    }, 300)
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
    <AccessGate orgId={orgId} pageKey="report-inventory-log">
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
              disabled={!startDate || !endDate || startDate > endDate || dateRangeDays > 32}
            />
          </div>
        </div>
        {dateRangeDays > 32 && (
          <p className="text-xs text-red-500 mt-1">Date range cannot exceed 32 days ({dateRangeDays} days selected).</p>
        )}

        {report ? (
          <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 ${REPORT_CARD}`}>
            <div className="px-4 sm:px-8 py-4">
              <InventoryTable
                report={report}
                startDate={reportStart}
                endDate={reportEnd}
              />
            </div>
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
      </div>
    </AccessGate>
  )
}

function InventoryTable({ report, startDate, endDate }) {
  const { fuelTypes, rows, totals, tanksByFuel, openingByFuel, fuelHasRouting } = report

  const hdr = REPORT_HEAD
  const subHdr = REPORT_SUBHEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-1.5 py-1 whitespace-nowrap`
  const cellR = `${cell} text-right`

  // Per-fuel column shape
  const tankCountFor = (ft) => (tanksByFuel[ft] || []).length
  const showClosingTotalFor = (ft) => tankCountFor(ft) > 1
  const closingColsFor = (ft) => tankCountFor(ft) + (showClosingTotalFor(ft) ? 1 : 0)
  const showPerTankOvshFor = (ft) => tankCountFor(ft) > 1 && !!fuelHasRouting[ft]
  const ovshColsFor = (ft) => (showPerTankOvshFor(ft) ? tankCountFor(ft) : 0) + 1

  const closingCols = fuelTypes.reduce((s, ft) => s + closingColsFor(ft), 0)
  const ovshCols = fuelTypes.reduce((s, ft) => s + ovshColsFor(ft), 0)
  const fuelCols = fuelTypes.length
  // 2 fixed (Sheet, Date) + closing + tank ov/sh + 6 single-col-per-fuel groups
  const totalCols = 2 + closingCols + ovshCols + 6 * fuelCols

  const ovshColor = (v) => {
    if (v == null || v === 0) return ''
    return v < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
  }

  const dayOf = (date) => Number(String(date).slice(8, 10))

  // Pre-compute per-tank tank-ov/sh sums for fuels that show per-tank columns
  const perTankOvshSum = {}
  for (const ft of fuelTypes) {
    if (!showPerTankOvshFor(ft)) continue
    perTankOvshSum[ft] = {}
    for (const tk of tanksByFuel[ft]) {
      perTankOvshSum[ft][tk.id] = rows.reduce((s, r) => {
        const tk2 = (r.fuels[ft]?.tanks || []).find(x => x.tankId === tk.id)
        return s + (tk2?.tankOvsh || 0)
      }, 0)
    }
  }

  return (
    <div className="min-w-[1200px] pb-4">
      <h2 className="text-base font-bold text-content mb-2">
        Inventory Log — {fmtDate(startDate)} to {fmtDate(endDate)}
      </h2>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th colSpan={totalCols} className={`${hdr} px-2 py-1.5 text-center font-bold`}>
              INVENTORY
            </th>
          </tr>
          <tr className={subHdr}>
            <th rowSpan={2} className={`${cell} font-bold`}>Sheet</th>
            <th rowSpan={2} className={`${cell} font-bold`}>Date</th>
            <th colSpan={closingCols} className={`${cell} text-center font-bold`}>Closing Stock</th>
            <th colSpan={ovshCols} className={`${cell} text-center font-bold`}>Tank OV/SH</th>
            <th colSpan={fuelCols} className={`${cell} text-center font-bold`}>Actual OV/SH</th>
            <th colSpan={fuelCols} className={`${cell} text-center font-bold`}>Variance</th>
            <th colSpan={fuelCols} className={`${cell} text-center font-bold`}>UGT Dispensed</th>
            <th colSpan={fuelCols} className={`${cell} text-center font-bold`}>Expected Supply</th>
            <th colSpan={fuelCols} className={`${cell} text-center font-bold`}>Actual Supply</th>
            <th colSpan={fuelCols} className={`${cell} text-center font-bold`}>Driver Shortage</th>
          </tr>
          <tr className={subHdr}>
            {/* Closing Stock sub-headers */}
            {fuelTypes.map(ft => (
              <Fragment key={`c-${ft}`}>
                {(tanksByFuel[ft] || []).map(tk => (
                  <th key={`c-${ft}-${tk.id}`} className={`${cellR} font-bold text-xs`}>{ft} {tk.tank_number}</th>
                ))}
                {showClosingTotalFor(ft) && (
                  <th key={`c-${ft}-total`} className={`${cellR} font-bold text-xs`}>{ft} Total</th>
                )}
              </Fragment>
            ))}
            {/* Tank OV/SH sub-headers */}
            {fuelTypes.map(ft => (
              <Fragment key={`o-${ft}`}>
                {showPerTankOvshFor(ft) && (tanksByFuel[ft] || []).map(tk => (
                  <th key={`o-${ft}-${tk.id}`} className={`${cellR} font-bold text-xs`}>{ft} {tk.tank_number}</th>
                ))}
                <th key={`o-${ft}-total`} className={`${cellR} font-bold text-xs`}>
                  {showPerTankOvshFor(ft) ? `${ft} Total` : ft}
                </th>
              </Fragment>
            ))}
            {/* Single-col-per-fuel groups */}
            {fuelTypes.map(ft => <th key={`ao-${ft}`} className={`${cellR} font-bold text-xs`}>{ft}</th>)}
            {fuelTypes.map(ft => <th key={`vr-${ft}`} className={`${cellR} font-bold text-xs`}>{ft}</th>)}
            {fuelTypes.map(ft => <th key={`ud-${ft}`} className={`${cellR} font-bold text-xs`}>{ft}</th>)}
            {fuelTypes.map(ft => <th key={`es-${ft}`} className={`${cellR} font-bold text-xs`}>{ft}</th>)}
            {fuelTypes.map(ft => <th key={`as-${ft}`} className={`${cellR} font-bold text-xs`}>{ft}</th>)}
            {fuelTypes.map(ft => <th key={`ds-${ft}`} className={`${cellR} font-bold text-xs`}>{ft}</th>)}
          </tr>
        </thead>
        <tbody>
          {/* Opening row — per-tank opening at period start (Excel R4) */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}></td>
            <td className={cell}>Opening</td>
            {fuelTypes.map(ft => {
              const opening = openingByFuel[ft] || { tanks: [], totalOpening: 0 }
              const openingByTankId = {}
              for (const tk of opening.tanks) openingByTankId[tk.tankId] = tk
              return (
                <Fragment key={`open-c-${ft}`}>
                  {(tanksByFuel[ft] || []).map(tk => (
                    <td key={`open-c-${ft}-${tk.id}`} className={cellR}>{fmt(openingByTankId[tk.id]?.opening)}</td>
                  ))}
                  {showClosingTotalFor(ft) && (
                    <td key={`open-c-${ft}-total`} className={cellR}>{fmt(opening.totalOpening)}</td>
                  )}
                </Fragment>
              )
            })}
            {/* Tank OV/SH cells — blank in opening row */}
            {fuelTypes.map(ft => (
              <Fragment key={`open-o-${ft}`}>
                {showPerTankOvshFor(ft) && (tanksByFuel[ft] || []).map(tk => (
                  <td key={`open-o-${ft}-${tk.id}`} className={cellR}></td>
                ))}
                <td key={`open-o-${ft}-total`} className={cellR}></td>
              </Fragment>
            ))}
            {/* Remaining 6 metric groups — blank */}
            {Array.from({ length: 6 * fuelCols }).map((_, i) => (
              <td key={`open-blank-${i}`} className={cellR}></td>
            ))}
          </tr>

          {rows.map(row => (
            <tr key={row.date} className={row.hasEntry ? '' : 'text-content-faint'}>
              <td className={cellR}>{dayOf(row.date)}</td>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
              {/* Closing Stock */}
              {fuelTypes.map(ft => {
                const f = row.fuels[ft] || {}
                const tankByIdMap = {}
                for (const tk of (f.tanks || [])) tankByIdMap[tk.tankId] = tk
                return (
                  <Fragment key={`c-${ft}`}>
                    {(tanksByFuel[ft] || []).map(tk => (
                      <td key={`c-${ft}-${tk.id}`} className={cellR}>{fmt(tankByIdMap[tk.id]?.closingStock)}</td>
                    ))}
                    {showClosingTotalFor(ft) && (
                      <td key={`c-${ft}-total`} className={cellR}>{fmt(f.totalClosing)}</td>
                    )}
                  </Fragment>
                )
              })}
              {/* Tank OV/SH */}
              {fuelTypes.map(ft => {
                const f = row.fuels[ft] || {}
                const tankByIdMap = {}
                for (const tk of (f.tanks || [])) tankByIdMap[tk.tankId] = tk
                return (
                  <Fragment key={`o-${ft}`}>
                    {showPerTankOvshFor(ft) && (tanksByFuel[ft] || []).map(tk => {
                      const tk2 = tankByIdMap[tk.id]
                      return (
                        <td key={`o-${ft}-${tk.id}`} className={`${cellR} ${ovshColor(tk2?.tankOvsh)}`}>{fmtSigned(tk2?.tankOvsh)}</td>
                      )
                    })}
                    <td key={`o-${ft}-total`} className={`${cellR} ${ovshColor(f.tankOvsh)}`}>{fmtSigned(f.tankOvsh)}</td>
                  </Fragment>
                )
              })}
              {/* Actual OV/SH */}
              {fuelTypes.map(ft => {
                const f = row.fuels[ft] || {}
                return <td key={`ao-${ft}`} className={`${cellR} ${ovshColor(f.actualOvsh)}`}>{fmtSigned(f.actualOvsh)}</td>
              })}
              {/* Variance */}
              {fuelTypes.map(ft => {
                const f = row.fuels[ft] || {}
                return <td key={`vr-${ft}`} className={`${cellR} ${ovshColor(f.variance)}`}>{fmtSigned(f.variance)}</td>
              })}
              {/* UGT Dispensed */}
              {fuelTypes.map(ft => (
                <td key={`ud-${ft}`} className={cellR}>{fmt(row.fuels[ft]?.ugtDispensed)}</td>
              ))}
              {/* Expected Supply */}
              {fuelTypes.map(ft => (
                <td key={`es-${ft}`} className={cellR}>{fmt(row.fuels[ft]?.expectedSupply)}</td>
              ))}
              {/* Actual Supply */}
              {fuelTypes.map(ft => (
                <td key={`as-${ft}`} className={cellR}>{fmt(row.fuels[ft]?.actualSupply)}</td>
              ))}
              {/* Driver Shortage */}
              {fuelTypes.map(ft => {
                const f = row.fuels[ft] || {}
                return <td key={`ds-${ft}`} className={`${cellR} ${ovshColor(f.driverShortage)}`}>{fmtSigned(f.driverShortage)}</td>
              })}
            </tr>
          ))}

          {/* Totals row */}
          <tr className={`${subHdr} font-bold`}>
            <td className={cell}></td>
            <td className={cell}>Total</td>
            {/* Closing Stock — blank (snapshot, not summable) */}
            {fuelTypes.map(ft => (
              <Fragment key={`tc-${ft}`}>
                {(tanksByFuel[ft] || []).map(tk => (
                  <td key={`tc-${ft}-${tk.id}`} className={cellR}></td>
                ))}
                {showClosingTotalFor(ft) && (
                  <td key={`tc-${ft}-total`} className={cellR}></td>
                )}
              </Fragment>
            ))}
            {/* Tank OV/SH — sums */}
            {fuelTypes.map(ft => {
              const t = totals[ft] || {}
              return (
                <Fragment key={`to-${ft}`}>
                  {showPerTankOvshFor(ft) && (tanksByFuel[ft] || []).map(tk => {
                    const v = perTankOvshSum[ft]?.[tk.id]
                    return (
                      <td key={`to-${ft}-${tk.id}`} className={`${cellR} ${ovshColor(v)}`}>{fmtSigned(v)}</td>
                    )
                  })}
                  <td key={`to-${ft}-total`} className={`${cellR} ${ovshColor(t.tankOvsh)}`}>{fmtSigned(t.tankOvsh)}</td>
                </Fragment>
              )
            })}
            {fuelTypes.map(ft => (
              <td key={`tao-${ft}`} className={`${cellR} ${ovshColor(totals[ft]?.actualOvsh)}`}>{fmtSigned(totals[ft]?.actualOvsh)}</td>
            ))}
            {fuelTypes.map(ft => (
              <td key={`tvr-${ft}`} className={`${cellR} ${ovshColor(totals[ft]?.variance)}`}>{fmtSigned(totals[ft]?.variance)}</td>
            ))}
            {fuelTypes.map(ft => (
              <td key={`tud-${ft}`} className={cellR}>{fmt(totals[ft]?.ugtDispensed)}</td>
            ))}
            {fuelTypes.map(ft => (
              <td key={`tes-${ft}`} className={cellR}>{fmt(totals[ft]?.expectedSupply)}</td>
            ))}
            {fuelTypes.map(ft => (
              <td key={`tas-${ft}`} className={cellR}>{fmt(totals[ft]?.actualSupply)}</td>
            ))}
            {fuelTypes.map(ft => (
              <td key={`tds-${ft}`} className={`${cellR} ${ovshColor(totals[ft]?.driverShortage)}`}>{fmtSigned(totals[ft]?.driverShortage)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}
