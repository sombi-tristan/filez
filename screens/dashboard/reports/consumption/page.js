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
import { REPORT_SUBHEAD, REPORT_LINE, REPORT_CARD } from '@/components/ui'

/**
 * Consumption: each day's fuel taken off the pumps on account (consumption) and put back into
 * the tanks (pour back), by account, from the daily sales readings (lib/consumptionCalculations.js
 * through buildDailyReport). One day at a time, Prev / Next as on the Summary report.
 */

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function ConsumptionPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <ConsumptionContent />
    </Suspense>
  )
}

function ConsumptionContent() {
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
  const liveCustomers = useLiveQuery(() => orgId ? db.customers.where('orgId').equals(orgId).toArray() : [], [orgId])

  const customerMap = useMemo(
    () => Object.fromEntries((liveCustomers || []).map((c) => [c.id, c.name || 'Unknown'])),
    [liveCustomers],
  )

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

  const entries = day?.consumption?.entries || []
  const consEntries = entries.filter((e) => !e.isPourBack)
  const pbEntries = entries.filter((e) => e.isPourBack)
  const fuels = (report?.fuelTypes || []).filter((ft) => {
    const f = day?.consumption?.byFuelType?.[ft]
    return f && (f.consumed || f.pourBack)
  })

  const entryTable = (title, rows) => (
    <table className="w-full border-collapse text-sm mb-4">
      <thead>
        <tr className={subHdr}>
          <th className={`${cell} text-left font-bold`} colSpan={4}>{title}</th>
        </tr>
        <tr className={subHdr}>
          <th className={`${cell} text-left font-bold`}>Account</th>
          <th className={`${cell} text-left font-bold`}>Fuel</th>
          <th className={`${cellR} font-bold`}>Qty</th>
          <th className={`${cellR} font-bold`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id}>
            <td className={cell}>{customerMap[c.customerId] || 'Unknown'}</td>
            <td className={cell}>{c.fuelType || ''}</td>
            <td className={cellR}>{fmt(c.quantity)}</td>
            <td className={cellR}>{fmt(c.quantity * (c.price || 0))}</td>
          </tr>
        ))}
        <tr className={`${subHdr} font-bold`}>
          <td className={cell} colSpan={3}>Total</td>
          <td className={cellR}>{fmt(rows.reduce((s, c) => s + c.quantity * (c.price || 0), 0))}</td>
        </tr>
      </tbody>
    </table>
  )

  return (
    <AccessGate orgId={orgId} pageKey="report-audit-consumption">
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
          {entries.length === 0 ? (
            <p className="text-content-faint text-sm py-6 text-center">No consumption or pour back on this day.</p>
          ) : (
            <>
              {/* Each fuel's litres consumed and poured back. */}
              <table className="w-full border-collapse text-sm mb-4">
                <thead>
                  <tr className={subHdr}>
                    <th className={`${cell} text-left font-bold`}></th>
                    <th className={`${cellR} font-bold`}>Consumption</th>
                    <th className={`${cellR} font-bold`}>Pour Back</th>
                  </tr>
                </thead>
                <tbody>
                  {fuels.map((ft) => (
                    <tr key={ft}>
                      <td className={`${cell} font-bold`}>{ft}</td>
                      <td className={cellR}>{fmt(day.consumption.byFuelType[ft].consumed)}</td>
                      <td className={cellR}>{fmt(day.consumption.byFuelType[ft].pourBack)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {consEntries.length > 0 && entryTable('Consumption', consEntries)}
              {pbEntries.length > 0 && entryTable('Pour Back', pbEntries)}
            </>
          )}
        </div>
      )}
    </div>
      )}
    </AccessGate>
  )
}
