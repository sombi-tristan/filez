'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2 } from 'lucide-react'
import { db } from '@/lib/db'
import DateRange from '@/components/reports/DateRange'
import AccessGate from '@/components/AccessGate'
import { fmtDate } from '@/lib/formatDate'
import { REPORT_HEAD, REPORT_LINE, REPORT_TOTAL_FILL, OUTLINE_WITHIN, BTN_PRIMARY, REPORT_CARD } from '@/components/ui'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtDec(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function LubeReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <LubeReportContent />
    </Suspense>
  )
}

function LubeReportContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const [loading, setLoading] = useState(true)
  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`
  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [generated, setGenerated] = useState(true)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)
  const [activeTab, setActiveTab] = useState('daily-log')

  const [products, setProducts] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      const prods = await db.lubeProducts.where('orgId').equals(orgId).toArray()
      setProducts(prods)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [orgId])

  const liveLubeSales = useLiveQuery(
    () => orgId ? db.lubeSales.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const liveLubeStock = useLiveQuery(
    () => orgId ? db.lubeStock.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  const liveLodgements = useLiveQuery(
    () => orgId ? db.lodgements.where('orgId').equals(orgId).toArray() : [],
    [orgId]
  )

  // Product lookup
  const productMap = useMemo(() => {
    return Object.fromEntries(products.map(p => [p.id, p]))
  }, [products])

  // Build daily log data
  const dailyLog = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !liveLubeSales || !liveLodgements) return null

    // Filter lube sales in range
    const salesInRange = liveLubeSales.filter(s => s.entryDate >= reportStart && s.entryDate <= reportEnd)

    // Filter lube lodgements in range
    const lubeLodgements = liveLodgements.filter(l =>
      l.lodgementType === 'lube-deposit' && l.entryDate >= reportStart && l.entryDate <= reportEnd
    )

    // Build rows: each sale entry is a row
    // Group by date, then flatten
    const dateMap = {}

    for (const sale of salesInRange) {
      const d = sale.entryDate
      if (!dateMap[d]) dateMap[d] = { sales: [], lodgements: [] }
      dateMap[d].sales.push(sale)
    }

    for (const lodg of lubeLodgements) {
      const d = lodg.entryDate
      if (!dateMap[d]) dateMap[d] = { sales: [], lodgements: [] }
      dateMap[d].lodgements.push(lodg)
    }

    const dates = Object.keys(dateMap).sort()
    const rows = []

    // Get sales before range for opening balance
    const salesBefore = liveLubeSales.filter(s => s.entryDate < reportStart)
    const lodgementsBefore = liveLodgements.filter(l =>
      l.lodgementType === 'lube-deposit' && l.entryDate < reportStart
    )
    const totalSalesBefore = salesBefore.reduce((sum, s) => sum + ((Number(s.unitSold) || 0) * (Number(s.price) || 0)), 0)
    const totalLodgementsBefore = lodgementsBefore.reduce((sum, l) => sum + (Number(l.amount) || 0), 0)

    // Opening balance = cumulative sales amount - cumulative lodgements before the period
    // This represents outstanding lube cash not yet lodged
    let runningBalance = totalSalesBefore - totalLodgementsBefore

    for (const date of dates) {
      const { sales, lodgements } = dateMap[date]

      // Each sale is a row
      for (const sale of sales) {
        const productName = productMap[sale.productId]?.product_name || '—'
        const qty = Number(sale.unitSold) || 0
        const amount = qty * (Number(sale.price) || 0)
        const received = Number(sale.unitReceived) || 0

        rows.push({
          date,
          product: productName,
          qtyOut: qty,
          amount,
          lodgement: 0,
          qtyIn: received,
          balance: null, // set below
        })
      }

      // Each lodgement is a row
      for (const lodg of lodgements) {
        rows.push({
          date,
          product: '',
          qtyOut: 0,
          amount: 0,
          lodgement: Number(lodg.amount) || 0,
          qtyIn: 0,
          balance: null,
        })
      }

      // If a date has lodgements but no sales, the lodgement rows are already added above
    }

    // Calculate running balance
    for (const row of rows) {
      runningBalance = runningBalance + row.amount - row.lodgement
      row.balance = runningBalance
    }

    const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0)
    const totalLodgement = rows.reduce((sum, r) => sum + r.lodgement, 0)

    return { rows, openingBalance: totalSalesBefore - totalLodgementsBefore, totalAmount, totalLodgement, closingBalance: runningBalance }
  }, [generated, reportStart, reportEnd, loading, orgId, liveLubeSales, liveLodgements, productMap])

  // Build monthly summary data
  const summary = useMemo(() => {
    if (!generated || !reportStart || !reportEnd) return null
    if (loading || !orgId || !liveLubeSales || !liveLubeStock || !products.length) return null

    const salesInRange = liveLubeSales.filter(s => s.entryDate >= reportStart && s.entryDate <= reportEnd)
    const stockInRange = liveLubeStock.filter(s => s.entryDate >= reportStart && s.entryDate <= reportEnd)

    // Sales before range (for computing opening stock from entries)
    const salesBefore = liveLubeSales.filter(s => s.entryDate < reportStart)

    const rows = products.map((product, idx) => {
      const pid = product.id
      const opening = Number(product.opening_stock) || 0

      // Net movement before range: received - sold
      const netBefore = salesBefore
        .filter(s => s.productId === pid)
        .reduce((sum, s) => sum + (Number(s.unitReceived) || 0) - (Number(s.unitSold) || 0), 0)

      const computedOpening = opening + netBefore

      // Sales and received in range
      const productSales = salesInRange.filter(s => s.productId === pid)
      const totalSold = productSales.reduce((sum, s) => sum + (Number(s.unitSold) || 0), 0)
      const totalAmount = productSales.reduce((sum, s) => sum + ((Number(s.unitSold) || 0) * (Number(s.price) || 0)), 0)
      const totalReceived = productSales.reduce((sum, s) => sum + (Number(s.unitReceived) || 0), 0)

      const expectedClosing = computedOpening + totalReceived - totalSold

      // Actual closing: latest stock entry for this product in range
      const stockEntries = stockInRange
        .filter(s => s.productId === pid)
        .sort((a, b) => (b.entryDate || '').localeCompare(a.entryDate || ''))
      const actualClosing = stockEntries.length > 0 ? (Number(stockEntries[0].stock) || 0) : null

      const variance = actualClosing !== null ? actualClosing - expectedClosing : null

      return {
        sn: idx + 1,
        product: product.product_name,
        opening: computedOpening,
        sold: totalSold,
        amount: totalAmount,
        received: totalReceived,
        expectedClosing,
        actualClosing,
        variance,
      }
    })

    const totals = {
      opening: rows.reduce((s, r) => s + r.opening, 0),
      sold: rows.reduce((s, r) => s + r.sold, 0),
      amount: rows.reduce((s, r) => s + r.amount, 0),
      received: rows.reduce((s, r) => s + r.received, 0),
      expectedClosing: rows.reduce((s, r) => s + r.expectedClosing, 0),
      actualClosing: rows.every(r => r.actualClosing !== null) ? rows.reduce((s, r) => s + r.actualClosing, 0) : null,
      variance: rows.every(r => r.variance !== null) ? rows.reduce((s, r) => s + r.variance, 0) : null,
    }

    return { rows, totals }
  }, [generated, reportStart, reportEnd, loading, orgId, liveLubeSales, liveLubeStock, products, productMap])

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
    <AccessGate orgId={orgId} pageKey="report-lube">
      {({ isOwner }) => (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Header + date range */}
      <div className="flex items-center justify-between py-3 shrink-0">
        <h1 className="text-lg font-bold text-content">Lube Report</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateRange
            start={startDate}
            end={endDate}
            onStart={setStartDate}
            onEnd={setEndDate}
            onGenerate={handleGenerate}
            disabled={!startDate || !endDate || startDate > endDate}
          />
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 pb-10 ${REPORT_CARD}`}>
        {!generated ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-content-faint text-sm">Select a date range and click Generate.</p>
          </div>
        ) : activeTab === 'daily-log' ? (
          <DailyLogTable data={dailyLog} cell={cell} cellR={cellR} hdr={hdr} />
        ) : (
          <SummaryTable data={summary} cell={cell} cellR={cellR} hdr={hdr} />
        )}
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-t border-line bg-surface flex">
        {[
          { key: 'daily-log', label: 'Daily Lube Log' },
          { key: 'summary', label: 'Stock Summary' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-xs font-medium border-r border-line ${activeTab === tab.key ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 border-b-2 border-b-blue-600' : 'text-content-muted hover:text-content-strong hover:bg-subtle'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
      )}
    </AccessGate>
  )
}

function DailyLogTable({ data, cell, cellR, hdr }) {
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>
  if (data.rows.length === 0) return <div className="flex items-center justify-center py-20"><p className="text-content-faint text-sm">No lube sales or lodgements in this date range.</p></div>

  let prevDate = null

  return (
    <table className="w-full text-xs border-collapse min-w-[700px]">
      <thead>
        <tr>
          <th className={`${cell} ${hdr} text-left`}>Date</th>
          <th className={`${cell} ${hdr} text-left`}>Product Sold</th>
          <th className={`${cell} ${hdr} text-right`}>Out</th>
          <th className={`${cell} ${hdr} text-right`}>Amount</th>
          <th className={`${cell} ${hdr} text-right`}>Lodgement</th>
          <th className={`${cell} ${hdr} text-right`}>Balance</th>
          <th className={`${cell} ${hdr} text-right`}>In</th>
        </tr>
      </thead>
      <tbody>
        {/* Opening balance row */}
        <tr className={`${REPORT_TOTAL_FILL} font-medium`}>
          <td className={cell} colSpan={5}>Opening Balance</td>
          <td className={cellR}>{fmtDec(data.openingBalance)}</td>
          <td className={cell}></td>
        </tr>
        {data.rows.map((row, i) => {
          const showDate = row.date !== prevDate
          prevDate = row.date
          return (
            <tr key={i} className="hover:bg-primary-50/40">
              <td className={`${cellR} whitespace-nowrap`}>{showDate ? fmtDate(row.date) : ''}</td>
              <td className={cell}>{row.product || (row.lodgement > 0 ? 'Lodgement' : '')}</td>
              <td className={cellR}>{row.qtyOut > 0 ? fmt(row.qtyOut) : ''}</td>
              <td className={cellR}>{row.amount > 0 ? fmtDec(row.amount) : ''}</td>
              <td className={cellR}>{row.lodgement > 0 ? fmtDec(row.lodgement) : ''}</td>
              <td className={cellR}>{fmtDec(row.balance)}</td>
              <td className={cellR}>{row.qtyIn > 0 ? fmt(row.qtyIn) : ''}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr className="font-bold bg-primary-50 dark:bg-primary-950/40">
          <td className={cell} colSpan={3}>Total</td>
          <td className={cellR}>{fmtDec(data.totalAmount)}</td>
          <td className={cellR}>{fmtDec(data.totalLodgement)}</td>
          <td className={cellR}>{fmtDec(data.closingBalance)}</td>
          <td className={cell}></td>
        </tr>
      </tfoot>
    </table>
  )
}

function SummaryTable({ data, cell, cellR, hdr }) {
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>
  if (data.rows.length === 0) return <div className="flex items-center justify-center py-20"><p className="text-content-faint text-sm">No lube products configured.</p></div>

  return (
    <table className="w-full text-xs border-collapse min-w-[900px]">
      <thead>
        <tr>
          <th className={`${cell} ${hdr} text-center`}>SN</th>
          <th className={`${cell} ${hdr} text-left`}>Product</th>
          <th className={`${cell} ${hdr} text-right`}>Opening</th>
          <th className={`${cell} ${hdr} text-right`}>Sales</th>
          <th className={`${cell} ${hdr} text-right`}>Amount</th>
          <th className={`${cell} ${hdr} text-right`}>Received</th>
          <th className={`${cell} ${hdr} text-right`}>Expected Closing</th>
          <th className={`${cell} ${hdr} text-right`}>Actual Closing</th>
          <th className={`${cell} ${hdr} text-right`}>Variance</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) => {
          const varianceColor = row.variance !== null
            ? row.variance < 0 ? 'text-red-600 dark:text-red-400 font-medium' : row.variance > 0 ? 'text-green-600 dark:text-green-400 font-medium' : ''
            : ''
          return (
            <tr key={row.sn} className="hover:bg-primary-50/40">
              <td className={`${cell} text-center`}>{row.sn}</td>
              <td className={cell}>{row.product}</td>
              <td className={cellR}>{fmt(row.opening)}</td>
              <td className={cellR}>{fmt(row.sold)}</td>
              <td className={cellR}>{fmtDec(row.amount)}</td>
              <td className={cellR}>{fmt(row.received)}</td>
              <td className={cellR}>{fmt(row.expectedClosing)}</td>
              <td className={cellR}>{row.actualClosing !== null ? fmt(row.actualClosing) : '—'}</td>
              <td className={`${cellR} ${varianceColor}`}>{row.variance !== null ? fmt(row.variance) : '—'}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr className="font-bold bg-primary-50 dark:bg-primary-950/40">
          <td className={cell} colSpan={2}>Total</td>
          <td className={cellR}>{fmt(data.totals.opening)}</td>
          <td className={cellR}>{fmt(data.totals.sold)}</td>
          <td className={cellR}>{fmtDec(data.totals.amount)}</td>
          <td className={cellR}>{fmt(data.totals.received)}</td>
          <td className={cellR}>{fmt(data.totals.expectedClosing)}</td>
          <td className={cellR}>{data.totals.actualClosing !== null ? fmt(data.totals.actualClosing) : '—'}</td>
          <td className={`${cellR} ${data.totals.variance !== null ? (data.totals.variance < 0 ? 'text-red-600 dark:text-red-400' : data.totals.variance > 0 ? 'text-green-600 dark:text-green-400' : '') : ''}`}>
            {data.totals.variance !== null ? fmt(data.totals.variance) : '—'}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}
