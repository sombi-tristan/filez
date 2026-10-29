'use client'

import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '@/design'
import { fmtDate } from '@/lib/formatDate'
import { BTN_DANGER } from '@/components/ui'

const LITRES = 3
const pad = (n) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const fmt = (n, dp = 0) => Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: dp, maximumFractionDigits: dp })
const savedKey = (orgId) => `stationmgr:ago-reset:${orgId}`

/**
 * The Summary's AGO sheet (tap the date five times): each day since the last Reset, that day's
 * highest AGO price times 3 litres, and the totals. The reset date is the station's, kept on the
 * server (app/api/stations/[stationId]/ago-reset, migration 059) so every phone lists the same;
 * the last one fetched is kept on this phone for when there is no connection.
 */
export default function AgoSheet({ open, onClose, orgId, sales }) {
  const [resetDate, setResetDate] = useState(null)
  const [state, setState] = useState('idle') // idle | loading | offline | resetting | failed
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open || !orgId) return
    let alive = true
    setConfirming(false)
    try { setResetDate(localStorage.getItem(savedKey(orgId)) || null) } catch {}
    setState('loading')
    fetch(`/api/stations/${orgId}/ago-reset`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(({ resetDate: d }) => {
        if (!alive) return
        setResetDate(d)
        try { d ? localStorage.setItem(savedKey(orgId), d) : localStorage.removeItem(savedKey(orgId)) } catch {}
        setState('idle')
      })
      .catch(() => { if (alive) setState('offline') })
    return () => { alive = false }
  }, [open, orgId])

  // One row per day with an AGO price, from the reset date (or the first day) to today.
  const rows = useMemo(() => {
    const end = today()
    const byDay = new Map()
    for (const s of sales || []) {
      const day = s.entryDate
      if (!day || day > end || (resetDate && day < resetDate)) continue
      const price = Number(s.prices?.AGO) || 0
      if (price > (byDay.get(day) || 0)) byDay.set(day, price)
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, price]) => ({ date, price, amount: price * LITRES }))
  }, [sales, resetDate])

  const total = rows.reduce((t, r) => t + r.amount, 0)

  const reset = async () => {
    if (!confirming) { setConfirming(true); return }
    setConfirming(false)
    setState('resetting')
    const date = today()
    try {
      const r = await fetch(`/api/stations/${orgId}/ago-reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }),
      })
      if (!r.ok) throw new Error()
      setResetDate(date)
      try { localStorage.setItem(savedKey(orgId), date) } catch {}
      setState('idle')
    } catch {
      setState('failed')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} label="AGO">
      <div className="px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[75vh] overflow-y-auto">
        <h3 className="text-base font-bold text-content">AGO × {LITRES} L</h3>
        <p className="text-xs text-content-muted mb-3">
          {resetDate ? `Since ${fmtDate(resetDate)}` : 'Since the first day'}: each day&apos;s highest AGO price
          {state === 'offline' && ' (offline: the last reset date this phone saw)'}
        </p>
        <div className="flex text-xs font-semibold text-content-muted uppercase tracking-wide pb-2 border-b border-line">
          <span className="flex-1">Date</span>
          <span className="w-24 text-right">Price</span>
          <span className="w-28 text-right">× {LITRES} L</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-content-faint">No AGO prices since the reset yet.</p>
        ) : rows.map((r) => (
          <div key={r.date} className="flex items-center py-2.5 border-b border-line text-sm">
            <span className="flex-1 font-semibold text-content">{fmtDate(r.date)}</span>
            <span className="w-24 text-right tabular-nums">{fmt(r.price, 2)}</span>
            <span className="w-28 text-right tabular-nums">{fmt(r.amount, 2)}</span>
          </div>
        ))}
        <div className="flex items-center pt-3 text-sm font-bold text-content">
          <span className="flex-1">Total · {rows.length} day{rows.length === 1 ? '' : 's'}, {fmt(rows.length * LITRES)} L</span>
          <span className="w-28 text-right tabular-nums">{fmt(total, 2)}</span>
        </div>
        {state === 'failed' && <p className="mt-3 text-sm text-red-600 dark:text-red-400">Could not reset. Check the connection and try again.</p>}
        <button
          type="button"
          onClick={reset}
          disabled={state === 'resetting' || state === 'offline'}
          className={`mt-4 w-full py-2.5 text-sm font-semibold disabled:opacity-40 ${BTN_DANGER}`}
        >
          {state === 'resetting' ? 'Resetting…' : confirming ? 'Tap again to start afresh from today' : 'Reset'}
        </button>
      </div>
    </BottomSheet>
  )
}
