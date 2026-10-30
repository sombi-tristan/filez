'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import { buildDailyReport } from '@/lib/buildDailyReport'
import DateRange from '@/components/reports/DateRange'
import DayNav, { DayTitle } from '@/components/reports/DayNav'
import { useReportDays, pickDay } from '@/components/reports/useReportDays'
import AccessGate from '@/components/AccessGate'
import { REPORT_SUBHEAD, REPORT_LINE, REPORT_TOTAL_FILL, REPORT_CARD } from '@/components/ui'

/**
 * Consumption & Fuel Stock: one day at a time, Prev / Next as on the Summary report.
 *   - Consumption: fuel taken off the pumps on account (consumption) and put back into the
 *     tanks (pour back), by account, from the daily sales readings.
 *   - Fuel Stock: the day's closing stock (dips) in one row: DATE, each PMS tank, TOTAL PMS,
 *     each AGO tank, TOTAL AGO, each DPK tank, TOTAL DPK; no total for a fuel with one tank.
 * Both from buildDailyReport (consumption, tanksByFuel).
 */

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function ConsumptionFuelStockPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <ConsumptionFuelStockContent />
    </Suspense>
  )
}

function ConsumptionFuelStockContent() {
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

  // PMS 1, PMS 2, TOTAL PMS, AGO, ...: a fuel with one tank has no number and no total.
  const stockCols = (report?.fuelTypes || []).flatMap((ft) => {
    const f = day?.tanksByFuel?.[ft]
    if (!f?.tanks?.length) return []
    const cols = f.tanks.map((t) => ({ key: t.tankId, label: f.tanks.length > 1 ? t.label : ft, value: t.closing }))
    if (f.tanks.length > 1) cols.push({ key: ft + '-total', label: `TOTAL ${ft}`, value: f.totalClosing, total: true })
    return cols
  })

  // The accounts, then each fuel's litres and amount, then the grand total when there is more
  // than one fuel.
  const amountOf = (list) => list.reduce((s, c) => s + c.quantity * (c.price || 0), 0)
  const entryTable = (title, rows) => {
    const byFuel = (report?.fuelTypes || [])
      .map((ft) => ({ ft, list: rows.filter((c) => c.fuelType === ft) }))
      .filter((g) => g.list.length)
    return (
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
        {byFuel.map(({ ft, list }) => (
          <tr key={ft} className={`${REPORT_TOTAL_FILL} font-bold`}>
            <td className={cell} colSpan={2}>Total {ft}</td>
            <td className={cellR}>{fmt(list.reduce((s, c) => s + c.quantity, 0))}</td>
            <td className={cellR}>{fmt(amountOf(list))}</td>
          </tr>
        ))}
        {byFuel.length > 1 && (
          <tr className={`${subHdr} font-bold`}>
            <td className={cell} colSpan={3}>Total</td>
            <td className={cellR}>{fmt(amountOf(rows))}</td>
          </tr>
        )}
      </tbody>
    </table>
    )
  }

  return (
    <AccessGate orgId={orgId} pageKey="report-audit-consumption">
      {() => (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] lg:max-w-none mx-auto px-2 sm:px-6 lg:px-2">
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

      {!report ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>
      ) : !day ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-content-faint text-sm">No data for this period.</p>
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 px-1 sm:px-[15%] ${REPORT_CARD}`}>
          <DayTitle date={day.date} />
          {/* 1. Consumption and pour back */}
          {entries.length === 0 ? (
            <table className="w-full border-collapse text-sm mb-4">
              <tbody>
                <tr className={subHdr}><th className={`${cell} text-left font-bold`}>Consumption</th></tr>
                <tr><td className={`${cell} text-content-faint`}>No consumption or pour back on this day.</td></tr>
              </tbody>
            </table>
          ) : (
            <>
              {consEntries.length > 0 && entryTable('Consumption', consEntries)}
              {pbEntries.length > 0 && entryTable('Pour Back', pbEntries)}
            </>
          )}

          {/* 2. Fuel stock: the day's closing stock (dips), each tank, and each fuel's total
              when it has more than one tank. */}
          <div className="overflow-x-auto mb-4">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className={subHdr}>
                <th className={`${cell} text-left font-bold whitespace-nowrap`}>DATE</th>
                {stockCols.map((c) => (
                  <th key={c.key} className={`${cellR} font-bold whitespace-nowrap`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${cell} font-bold whitespace-nowrap`}>{day.date.split('-').reverse().join('-')}</td>
                {stockCols.map((c) => (
                  <td key={c.key} className={`${cellR} ${c.total ? `${REPORT_TOTAL_FILL} font-bold` : ''}`}>{fmt(c.value)}</td>
                ))}
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}

      {report && <DayNav index={index} total={total} onPrev={goPrev} onNext={goNext} />}
    </div>
      )}
    </AccessGate>
  )
}
