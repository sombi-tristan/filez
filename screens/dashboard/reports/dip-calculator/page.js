'use client'

import { Suspense, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import { Loader2 } from 'lucide-react'
import Link from '@/lib/nav'
import { REPORT_HEAD, REPORT_LINE, BTN_FRAMED, REPORT_CARD } from '@/components/ui'

export default function DipCalculatorPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <DipCalculatorContent />
    </Suspense>
  )
}

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  if (!isFinite(v)) return ''
  return v.toLocaleString('en-NG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function rowFromParams(searchParams, idx) {
  const n = idx + 1
  const g = (key) => Number(searchParams.get(`${key}${n}`)) || 0
  return {
    chartUllage: g('cU'), chartLH: g('cL'),
    depotUllage: g('dU'), depotLH: g('dL'),
    stationUllage: g('sU'), stationLH: g('sL'),
    highVol: g('hV'), lowVol: g('lV'),
    highUllage: g('hU'), lowUllage: g('lU'),
  }
}

function DipCalculatorContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const rows = useMemo(() => [0, 1, 2].map(i => rowFromParams(searchParams, i)), [searchParams])

  const calc = useMemo(() => {
    return rows.map(r => {
      const { chartUllage: cU, chartLH: cL, depotUllage: dU, depotLH: dL, stationUllage: sU, stationLH: sL, highVol: hV, lowVol: lV, highUllage: hU, lowUllage: lU } = r

      const ullDenom = hU - lU
      const ullageMF = ullDenom !== 0 ? (hV - lV) / ullDenom : 0
      const lhMF = cL !== 0 ? hV / cL : 0

      // Ullage-based
      const dsUDiff = dU - sU
      const csUDiff = cU - sU
      const cdUDiff = cU - dU
      const dsUVol = dsUDiff * ullageMF
      const csUVol = csUDiff * ullageMF
      const cdUVol = cdUDiff * ullageMF

      // Liquid Height-based
      const dsLDiff = (dL - sL) * -1
      const csLDiff = (cL - sL) * -1
      const cdLDiff = (cL - dL) * -1
      const dsLVol = dsLDiff * lhMF
      const csLVol = csLDiff * lhMF
      const cdLVol = cdLDiff * lhMF

      return { ullageMF, lhMF, dsUDiff, dsUVol, csUDiff, csUVol, cdUDiff, cdUVol, dsLDiff, dsLVol, csLDiff, csLVol, cdLDiff, cdLVol }
    })
  }, [rows])

  const totals = useMemo(() => {
    const sum = (key) => calc.reduce((s, c) => s + c[key], 0)
    return {
      dsUDiff: sum('dsUDiff'), dsUVol: sum('dsUVol'),
      csUDiff: sum('csUDiff'), csUVol: sum('csUVol'),
      cdUDiff: sum('cdUDiff'), cdUVol: sum('cdUVol'),
      dsLDiff: sum('dsLDiff'), dsLVol: sum('dsLVol'),
      csLDiff: sum('csLDiff'), csLVol: sum('csLVol'),
      cdLDiff: sum('cdLDiff'), cdLVol: sum('cdLVol'),
    }
  }, [calc])

  const hdr = REPORT_HEAD
  const bdr = `border ${REPORT_LINE}`
  const cell = `${bdr} px-2 py-1 text-xs whitespace-nowrap`
  const cellR = `${cell} text-right`
  const valCls = `${cellR}`

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] max-w-[900px] mx-auto px-4 sm:px-6">
      <div className="shrink-0 py-4 flex items-center gap-2">
        <h1 className="text-lg font-bold text-content mr-auto">Dip Calculator</h1>
        <Link
          href={`/dashboard/reports/product-received?org_id=${orgId}`}
          className={`px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}
        >
          Back
        </Link>
      </div>

      <div className={`flex-1 overflow-y-auto overflow-x-auto min-h-0 pb-4 ${REPORT_CARD}`}>
        {/* ─── Readings ─── */}
        <table className="w-full border-collapse min-w-0">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>DEPOT</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>STATION</th>
            </tr>
            <tr className="bg-primary-50 dark:bg-primary-950/40">
              <th className={`${cell} text-center w-10`}>#</th>
              <th className={`${cell} text-center`}>Ullage</th>
              <th className={`${cell} text-center`}>Liquid Ht</th>
              <th className={`${cell} text-center`}>Ullage</th>
              <th className={`${cell} text-center`}>Liquid Ht</th>
              <th className={`${cell} text-center`}>Ullage</th>
              <th className={`${cell} text-center`}>Liquid Ht</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-subtle`}>{i + 1}</td>
                <td className={valCls}>{fmt(r.chartUllage)}</td>
                <td className={valCls}>{fmt(r.chartLH)}</td>
                <td className={valCls}>{fmt(r.depotUllage)}</td>
                <td className={valCls}>{fmt(r.depotLH)}</td>
                <td className={valCls}>{fmt(r.stationUllage)}</td>
                <td className={valCls}>{fmt(r.stationLH)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ─── Calibration ─── */}
        <table className="w-full border-collapse min-w-0 mt-4">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`}>Highest Vol</th>
              <th className={`${cell} ${hdr} text-center`}>Lowest Vol</th>
              <th className={`${cell} ${hdr} text-center`}>Highest Ullage</th>
              <th className={`${cell} ${hdr} text-center`}>Lowest Ullage</th>
              <th className={`${cell} ${hdr} text-center`}>Ullage M.F</th>
              <th className={`${cell} ${hdr} text-center`}>Liquid Ht M.F</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-subtle w-10`}>{i + 1}</td>
                <td className={valCls}>{fmt(r.highVol)}</td>
                <td className={valCls}>{fmt(r.lowVol)}</td>
                <td className={valCls}>{fmt(r.highUllage)}</td>
                <td className={valCls}>{fmt(r.lowUllage)}</td>
                <td className={`${cellR} bg-subtle font-medium`}>{fmt(calc[i].ullageMF)}</td>
                <td className={`${cellR} bg-subtle font-medium`}>{fmt(calc[i].lhMF)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ─── Results: Ullage-based ─── */}
        <table className="w-full border-collapse min-w-0 mt-4">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>DEPOT TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO DEPOT</th>
            </tr>
            <tr className="bg-primary-50 dark:bg-primary-950/40">
              <th className={`${cell} text-center w-10`}>#</th>
              <th className={`${cell} text-center`}>Ullage Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Ullage Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Ullage Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
            </tr>
          </thead>
          <tbody>
            {calc.map((c, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-subtle`}>{i + 1}</td>
                <td className={cellR}>{fmt(c.dsUDiff)}</td>
                <td className={cellR}>{fmt(c.dsUVol)}</td>
                <td className={cellR}>{fmt(c.csUDiff)}</td>
                <td className={cellR}>{fmt(c.csUVol)}</td>
                <td className={cellR}>{fmt(c.cdUDiff)}</td>
                <td className={cellR}>{fmt(c.cdUVol)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-primary-50 dark:bg-primary-950/40">
              <td className={cell}>TOTAL</td>
              <td className={cellR}>{fmt(totals.dsUDiff)}</td>
              <td className={cellR}>{fmt(totals.dsUVol)}</td>
              <td className={cellR}>{fmt(totals.csUDiff)}</td>
              <td className={cellR}>{fmt(totals.csUVol)}</td>
              <td className={cellR}>{fmt(totals.cdUDiff)}</td>
              <td className={cellR}>{fmt(totals.cdUVol)}</td>
            </tr>
          </tbody>
        </table>

        {/* ─── Results: Liquid Height-based ─── */}
        <table className="w-full border-collapse min-w-0 mt-4">
          <thead>
            <tr>
              <th className={`${cell} ${hdr}`}></th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>DEPOT TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO STATION</th>
              <th className={`${cell} ${hdr} text-center`} colSpan={2}>CHART TO DEPOT</th>
            </tr>
            <tr className="bg-primary-50 dark:bg-primary-950/40">
              <th className={`${cell} text-center w-10`}>#</th>
              <th className={`${cell} text-center`}>Liquid Ht Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Liquid Ht Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
              <th className={`${cell} text-center`}>Liquid Ht Diff</th>
              <th className={`${cell} text-center`}>Vol</th>
            </tr>
          </thead>
          <tbody>
            {calc.map((c, i) => (
              <tr key={i}>
                <td className={`${cell} text-center font-medium bg-subtle`}>{i + 1}</td>
                <td className={cellR}>{fmt(c.dsLDiff)}</td>
                <td className={cellR}>{fmt(c.dsLVol)}</td>
                <td className={cellR}>{fmt(c.csLDiff)}</td>
                <td className={cellR}>{fmt(c.csLVol)}</td>
                <td className={cellR}>{fmt(c.cdLDiff)}</td>
                <td className={cellR}>{fmt(c.cdLVol)}</td>
              </tr>
            ))}
            <tr className="font-bold bg-primary-50 dark:bg-primary-950/40">
              <td className={cell}>TOTAL</td>
              <td className={cellR}>{fmt(totals.dsLDiff)}</td>
              <td className={cellR}>{fmt(totals.dsLVol)}</td>
              <td className={cellR}>{fmt(totals.csLDiff)}</td>
              <td className={cellR}>{fmt(totals.csLVol)}</td>
              <td className={cellR}>{fmt(totals.cdLDiff)}</td>
              <td className={cellR}>{fmt(totals.cdLVol)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
