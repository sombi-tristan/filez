'use client'

import { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, LineChart, BarChart, PieChart, Pie, Cell,
  Line, Bar, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { db } from '@/lib/db'
import { buildAnalyticsReport } from '@/lib/buildAnalyticsReport'
import { fmtDate } from '@/lib/formatDate'
import DateInput from '@/components/DateInput'
import AccessGate from '@/components/AccessGate'
import { REPORT_HEAD, OUTLINE_WITHIN, BTN_PRIMARY, CARD } from '@/components/ui'

const FUEL_COLORS = { PMS: '#2563eb', AGO: '#16a34a', DPK: '#f59e0b' }

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtCompact(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return (v / 1_000).toFixed(1) + 'K'
  return String(Math.round(v))
}

function fmtDay(s) {
  if (!s) return ''
  const d = new Date(s + 'T00:00:00')
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <AnalyticsContent />
    </Suspense>
  )
}

function AnalyticsContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [banks, setBanks] = useState([])

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
      const [noz, tnk, bnk] = await Promise.all([
        db.nozzles.where('orgId').equals(orgId).toArray(),
        db.tanks.where('orgId').equals(orgId).toArray(),
        db.banks.where('orgId').equals(orgId).toArray(),
      ])
      if (cancelled) return
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

  const dateRangeDays = useMemo(() => {
    if (!startDate || !endDate) return 0
    const ms = new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')
    return Math.floor(ms / 86400000) + 1
  }, [startDate, endDate])

  const report = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !nozzles.length || !liveSales || !liveReceipts || !liveLodgements) return null
    return buildAnalyticsReport({
      sales: liveSales,
      receipts: liveReceipts,
      lodgements: liveLodgements,
      nozzles,
      tanks,
      banks,
      startDate: reportStart,
      endDate: reportEnd,
    })
  }, [generated, reportStart, reportEnd, loading, orgId, nozzles, tanks, banks, liveSales, liveReceipts, liveLodgements])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    if (dateRangeDays > 92) {
      alert('Date range cannot exceed 92 days.')
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
    <AccessGate orgId={orgId} pageKey="report-analytics">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-end py-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DateInput value={startDate} onChange={setStartDate} className={`px-2 py-2 text-sm font-medium ${OUTLINE_WITHIN}`} />
            <span className="text-sm text-content-faint">to</span>
            <DateInput value={endDate} onChange={setEndDate} className={`px-2 py-2 text-sm font-medium ${OUTLINE_WITHIN}`} />
            <button
              onClick={handleGenerate}
              disabled={generating || !startDate || !endDate || startDate > endDate || dateRangeDays > 92}
              className={`px-4 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 ${BTN_PRIMARY}`}
            >
              {generating && <Loader2 className="w-4 h-4 animate-spin" />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
        {dateRangeDays > 92 && (
          <p className="text-xs text-red-500 mt-1">Date range cannot exceed 92 days ({dateRangeDays} days selected).</p>
        )}

        {report ? (
          <AnalyticsBody report={report} startDate={reportStart} endDate={reportEnd} />
        ) : generated ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <p className="text-content-faint text-sm">Select a date range and click Generate.</p>
          </div>
        )}
      </div>
    </AccessGate>
  )
}

function KpiTile({ label, value, sub, accent }) {
  return (
    <div className={`px-3 py-2.5 ${CARD}`}>
      <div className="text-[11px] text-content-muted uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-bold ${accent || 'text-content'}`}>{value}</div>
      {sub && <div className="text-[11px] text-content-faint">{sub}</div>}
    </div>
  )
}

function FuelStatTable({ fuelTypes, columns, totalRow, fuelRows }) {
  const showPerFuel = fuelTypes.length > 1
  const rowKeys = showPerFuel ? ['TOTAL', ...fuelTypes] : ['TOTAL']
  return (
    <div className={`overflow-x-auto mb-4 ${CARD}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={`${REPORT_HEAD} text-[11px] uppercase tracking-wide`}>
            <th className="px-3 py-2 text-left font-medium w-20"></th>
            {columns.map(c => (
              <th key={c.key} className="px-3 py-2 text-right font-medium whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowKeys.map((rk, i) => {
            const isTotal = rk === 'TOTAL'
            const data = isTotal ? totalRow : fuelRows[rk] || {}
            return (
              <tr key={rk} className={isTotal ? 'border-b-2 border-line' : i > 1 ? 'border-t border-line' : ''}>
                <td className={`px-3 py-2 ${isTotal ? 'font-bold text-content' : 'font-semibold'}`} style={!isTotal ? { color: FUEL_COLORS[rk] } : {}}>
                  {rk}
                </td>
                {columns.map(c => (
                  <td key={c.key} className={`px-3 py-2 text-right whitespace-nowrap ${isTotal ? 'font-bold text-content' : 'text-content-strong'} ${c.accent ? c.accent(data[c.key]) : ''}`}>
                    {c.format(data[c.key])}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, blurb, children }) {
  return (
    <section className="mb-8">
      <div className="mb-3 border-l-4 border-blue-600 pl-3">
        <h2 className="text-base font-bold text-content">{title}</h2>
        <p className="text-xs text-content-muted mt-0.5">{blurb}</p>
      </div>
      {children}
    </section>
  )
}

function AnalyticsBody({ report, startDate, endDate }) {
  const { fuelTypes, summary, fuelMix, stockSeries, varianceSeries, revenueSeries, ovshSeries } = report

  const fuelMixData = fuelTypes.map(ft => ({ name: ft, value: fuelMix[ft] || 0 }))

  const ovshAccent = summary.netOvsh < 0 ? 'text-red-600 dark:text-red-400' : summary.netOvsh > 0 ? 'text-green-600 dark:text-green-400' : ''
  const pendingAccent = summary.pendingLodgement > 0 ? 'text-amber-600 dark:text-amber-400' : ''

  const naira = (v) => v == null ? '' : '₦' + fmt(v)
  const liters = (v) => v == null ? '' : fmt(v) + ' L'

  // Sales & Volume table data
  const salesColumns = [
    { key: 'sales', label: 'Sales (₦)', format: naira },
    { key: 'volume', label: 'Volume (L)', format: liters },
    { key: 'avgSales', label: 'Avg / day (₦)', format: naira },
    { key: 'avgVolume', label: 'Avg / day (L)', format: liters },
  ]
  const salesTotalRow = {
    sales: summary.totalSales,
    volume: summary.totalVolume,
    avgSales: summary.avgDailyRevenue,
    avgVolume: summary.avgDailyVolume,
  }
  const salesFuelRows = {}
  for (const ft of fuelTypes) {
    salesFuelRows[ft] = {
      sales: summary.totalSalesByFuel?.[ft] || 0,
      volume: summary.totalVolumeByFuel?.[ft] || 0,
      avgSales: summary.avgDailyRevenueByFuel?.[ft] || 0,
      avgVolume: summary.avgDailyVolumeByFuel?.[ft] || 0,
    }
  }

  // Current stock table data
  const stockColumns = [
    { key: 'stock', label: 'Current Stock (L)', format: liters },
  ]
  const totalCurrentStock = Object.values(summary.currentStockByFuel || {}).reduce((s, v) => s + v, 0)
  const stockTotalRow = { stock: totalCurrentStock }
  const stockFuelRows = {}
  for (const ft of fuelTypes) {
    stockFuelRows[ft] = { stock: summary.currentStockByFuel?.[ft] || 0 }
  }

  return (
    <div className="pb-10">
      {/* SECTION 1 — Cash Reconciliation */}
      <Section
        title="Cash Reconciliation"
        blurb="How money lodged compares to expected sales. Lodgements are not split by fuel, so totals only. Negative = shortage, positive = overage."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          <KpiTile
            label="Net Cash OV/SH"
            value={(summary.netOvsh >= 0 ? '₦' : '-₦') + fmt(Math.abs(summary.netOvsh))}
            accent={ovshAccent}
            sub={summary.netOvsh < 0 ? 'shortage' : summary.netOvsh > 0 ? 'overage' : 'reconciled'}
          />
          <KpiTile
            label="Pending Lodgement"
            value={'₦' + fmt(Math.max(0, summary.pendingLodgement))}
            accent={pendingAccent}
            sub={summary.pendingLodgement > 0 ? 'sales not yet deposited' : 'all deposited'}
          />
        </div>

        <ChartCard
          title="Cumulative cash overage / shortage"
          subtitle="Running total of (lodged − expected sales) day by day. Crossing zero means earlier shortages have been recovered."
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={ovshSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
              <YAxis tickFormatter={fmtCompact} fontSize={11} />
              <Tooltip
                labelFormatter={(d) => fmtDate(d)}
                formatter={(value, name) => [naira(value), name === 'cumulative' ? 'Cumulative' : 'Daily']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="cumulative" stroke="#0f172a" strokeWidth={2} dot={false} isAnimationActive={false} name="Cumulative" />
              <Line type="monotone" dataKey="daily" stroke="#94a3b8" strokeWidth={1} dot={false} isAnimationActive={false} name="Daily" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

      {/* SECTION 2 — Sales & Volume */}
      <Section
        title="Sales & Volume"
        blurb="Revenue and dispensed volume across the period, broken down by fuel."
      >
        <FuelStatTable
          fuelTypes={fuelTypes}
          columns={salesColumns}
          totalRow={salesTotalRow}
          fuelRows={salesFuelRows}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
          <ChartCard title="Daily revenue" subtitle="Bar height = total sales for the day. Colors stack each fuel's contribution.">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
                <YAxis tickFormatter={fmtCompact} fontSize={11} />
                <Tooltip
                  labelFormatter={(d) => fmtDate(d)}
                  formatter={(value, name) => [naira(value), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {fuelTypes.map(ft => (
                  <Bar key={ft} dataKey={ft} stackId="a" fill={FUEL_COLORS[ft]} isAnimationActive={false} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Fuel mix" subtitle="Share of total revenue contributed by each fuel.">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip formatter={(value, name) => [naira(value), name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Pie
                  data={fuelMixData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  isAnimationActive={false}
                >
                  {fuelMixData.map((entry) => (
                    <Cell key={entry.name} fill={FUEL_COLORS[entry.name]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </Section>

      {/* SECTION 3 — Stock & Variance */}
      <Section
        title="Stock & Variance"
        blurb="Closing stock per fuel and how many liters each day was over or short vs expected."
      >
        <FuelStatTable
          fuelTypes={fuelTypes}
          columns={stockColumns}
          totalRow={stockTotalRow}
          fuelRows={stockFuelRows}
        />

        <ChartCard title="Stock level over time" subtitle="Closing stock per fuel each day. Dots mark days with new deliveries.">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={stockSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
              <YAxis tickFormatter={fmtCompact} fontSize={11} />
              <Tooltip
                labelFormatter={(d) => fmtDate(d)}
                formatter={(value, name) => name.endsWith('_delivery') ? null : [liters(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {fuelTypes.map(ft => (
                <Line
                  key={ft}
                  type="monotone"
                  dataKey={ft}
                  name={ft}
                  stroke={FUEL_COLORS[ft]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}
              {fuelTypes.map(ft => (
                <Scatter
                  key={`${ft}_dlv`}
                  dataKey={`${ft}_delivery`}
                  name={`${ft} delivery`}
                  fill={FUEL_COLORS[ft]}
                  shape="circle"
                  isAnimationActive={false}
                  legendType="none"
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Daily liters over / short"
          subtitle="Liters more (positive) or fewer (negative) in the tank than expected each day. Negative = stock loss."
        >
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={varianceSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} />
              <YAxis tickFormatter={fmtCompact} fontSize={11} />
              <Tooltip
                labelFormatter={(d) => fmtDate(d)}
                formatter={(value, name) => [liters(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="#9ca3af" />
              {fuelTypes.map(ft => (
                <Line
                  key={ft}
                  type="monotone"
                  dataKey={ft}
                  stroke={FUEL_COLORS[ft]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </Section>

    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div className={`p-3 mb-4 ${CARD}`}>
      <div className="mb-2">
        <h3 className="text-sm font-bold text-content">{title}</h3>
        {subtitle && <p className="text-xs text-content-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
