'use client'

import { useState, useEffect } from 'react'
import { Clock, RefreshCw, ArrowUpFromLine, ArrowDownToLine, Loader2 } from 'lucide-react'

/**
 * Top-of-hub card: the one accent surface on the page, solid brand blue with white text. The
 * station's initial on a round badge beside its name, Push and Pull as round white buttons on
 * the right, the pending count as the main line, and a lighter band at the bottom with the
 * consolidation countdown as a chip (and Clear queue, when entries are waiting). The same design
 * as the desktop build's.
 *
 * store's hero figure is money (lodgement balance). A station hub has no money figure of its
 * own, so the hero here is the number that actually governs the working day: how many entries
 * are waiting to be pushed. Nothing is invented — the station identity, the pending count and
 * the consolidation countdown were all already on this page, scattered between a bare heading
 * and a floating button row.
 *
 * The pip is literal white because it sits ON a filled coloured surface, where a surface token
 * would resolve to the page background and vanish. rounded-full is intended — the square-corner
 * rule exempts pills.
 */
// The count on the round Push button: a dark blue dot on its corner.
const COUNT_PIP = 'absolute -top-1 -right-1 bg-primary-800 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center' // design-exception

function nextConsolidation() {
  const now = new Date()
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0))
  let daysToAdd = (7 - now.getUTCDay()) % 7
  if (daysToAdd === 0 && now >= next) daysToAdd = 7
  next.setUTCDate(next.getUTCDate() + daysToAdd)
  return next
}

function formatCountdown(ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`
  return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
}

export default function StationWallet({
  station, pendingCount, syncing, refreshing, onPush, onPull, onClear,
}) {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(nextConsolidation() - new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const allSynced = pendingCount === 0
  // On the blue: Push and Pull are round white buttons; the band's chips are white-on-blue.
  const roundBtn = 'relative flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-white text-primary-600 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
  const chip = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-house bg-white/20 text-white'

  return (
    <div className="relative bg-primary-600 text-white rounded-house mb-4">
      <div className="flex items-start gap-3 p-3">
        <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white text-base font-bold" aria-hidden="true">
          {(station.name?.[0] || 'S').toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate">{station.name}</h1>
          {(station.location || station.station_group) && (
            <p className="text-xs text-white/80 truncate">
              {[station.location, station.station_group].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPush} disabled={syncing || allSynced} className={roundBtn} aria-label="Push" title="Push">
            {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpFromLine className="w-5 h-5" />}
            {pendingCount > 0 && <span className={COUNT_PIP}>{pendingCount > 9 ? '9+' : pendingCount}</span>}
          </button>
          <button onClick={onPull} disabled={refreshing} className={roundBtn} aria-label="Pull" title="Pull">
            {refreshing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownToLine className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-1.5 text-xs text-white uppercase tracking-wide mb-0.5">
          <RefreshCw className="w-3.5 h-3.5" /> {allSynced ? 'Sync status' : 'Waiting to push'}
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white">
          {allSynced ? 'All synced' : `${pendingCount} pending`}
        </p>
      </div>

      {/* The lighter band: when the day is next consolidated, and clearing what waits. */}
      {(countdown || pendingCount > 0) && (
        <div className="mx-2 mb-2 px-3 py-2 bg-white/15 rounded-house flex flex-wrap items-center gap-2">
          {countdown && (
            <span className={chip}><Clock className="w-3.5 h-3.5" />Next consolidation in <span className="font-mono">{countdown}</span></span>
          )}
          {pendingCount > 0 && (
            <button onClick={onClear} className={`${chip} hover:bg-white/30`}>Clear queue</button>
          )}
        </div>
      )}
    </div>
  )
}
