'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { buildDailyReport } from '@/lib/buildDailyReport'
import DateRange from '@/components/reports/DateRange'
import DayNav from '@/components/reports/DayNav'
import { useReportDays, pickDay } from '@/components/reports/useReportDays'
import AccessGate from '@/components/AccessGate'
import { REPORT_SUBHEAD, REPORT_LINE, REPORT_TOTAL_FILL, REPORT_CARD } from '@/components/ui'

/**
 * Fuel Stock: each day's tanks, fuel by fuel: opening stock (the day before's close), product
 * received, dispensed, closing stock (the day's dips) and over/short, from buildDailyReport's
 * tanksByFuel. One day at a time, Prev / Next as on the Summary report.
 */

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function FuelStockPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <FuelStockContent />
    </Suspense>
  )
}

function FuelStockContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const days = useReportDays()
  const { reportStart, reportEnd } = days

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    Promise.all([
      db.nozzles.where('orgId').equals(orgId).toArray(),
      db.tanks.where('orgId').equals(orgId).toArray(),
    ]).then(([noz, tnk]) => {
      if (cancelled) return
      setNozzles(noz)
      setTanks(tnk)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [orgId])

  const liveSales = useLiveQuery(() => orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : [], [orgId])
  const liveReceipts = useLiveQuery(() => orgId ? db.productReceipts.where('orgId').equals(orgId).toArray() : [], [orgId])

  const report = useMemo(() => {
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts) return null
    return buildDailyReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: [],
      nozzles,
      tanks,
      banks: [],
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [loading, orgId, nozzles, tanks, liveSales, liveReceipts, reportStart, reportEnd])

  const { index, total, day, goPrev, goNext } = pickDay(report?.dateReports, days.viewDate, days.setViewDate)

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>
  }

  if (!orgId) {
    return <div className="max-w-4xl px-4 sm:px-8 py-8"><p className="text-base text-content-muted">No station selected.</p></div>
  }

  const subHdr = REPORT_SUBHEAD
  const cell = `border ${REPORT_LINE} px-1 py-0.5`
  const cellR = `${cell} text-right`

  return (
    <AccessGate orgId={orgId} pageKey="report-audit-stock-summary">
      {() => (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-2 sm:px-6">
      <div className="flex items-center justify-end py-3 shrink-0">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateRange
            start={days.startDate}
            end={days.endDate}
            onStart={days.setStartDate}
            onEnd={days.setEndDate}
            onGenerate={days.handleGenerate}
            generating={days.generating}
            disabled={!days.startDate || !days.endDate || days.startDate > days.endDate}
          />
        </div>
      </div>

      {report && <DayNav date={day?.date} index={index} total={total} onPrev={goPrev} onNext={goNext} />}

      {!report ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
        </div>
      ) : !day ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-content-faint text-sm">No data for this period.</p>
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 px-1 sm:px-[15%] ${REPORT_CARD}`}>
          {report.fuelTypes.map((ft) => {
            const f = day.tanksByFuel?.[ft]
            if (!f?.tanks?.length) return null
            return (
              <table key={ft} className="w-full border-collapse text-sm mb-4">
                <thead>
                  <tr className={subHdr}>
                    <th className={`${cell} text-left font-bold`}>{ft}</th>
                    <th className={`${cellR} font-bold`}>Opening</th>
                    <th className={`${cellR} font-bold`}>Received</th>
                    <th className={`${cellR} font-bold`}>Dispensed</th>
                    <th className={`${cellR} font-bold`}>Closing</th>
                    <th className={`${cellR} font-bold`}>OV/SH</th>
                  </tr>
                </thead>
                <tbody>
                  {f.tanks.map((t) => (
                    <tr key={t.tankId}>
                      <td className={`${cell} font-bold whitespace-nowrap`}>{t.label}</td>
                      <td className={cellR}>{fmt(t.opening)}</td>
                      <td className={cellR}>{fmt(t.supply)}</td>
                      <td className={cellR}>{fmt(t.dispensed)}</td>
                      <td className={cellR}>{fmt(t.closing)}</td>
                      <td className={cellR}>{fmt(t.ovsh)}</td>
                    </tr>
                  ))}
                  <tr className={`${REPORT_TOTAL_FILL} font-bold`}>
                    <td className={cell}>Total</td>
                    <td className={cellR}>{fmt(f.totalOpening)}</td>
                    <td className={cellR}>{fmt(f.totalSupply)}</td>
                    <td className={cellR}>{fmt(f.totalDispensed)}</td>
                    <td className={cellR}>{fmt(f.totalClosing)}</td>
                    <td className={cellR}>{fmt(f.totalOvsh)}</td>
                  </tr>
                </tbody>
              </table>
            )
          })}
        </div>
      )}
    </div>
      )}
    </AccessGate>
  )
}
