'use client'

import { useEffect, useState } from 'react'
import { HardDrive, Loader2, ArrowUpFromLine, ArrowDownToLine, CloudUpload, Clock } from 'lucide-react'
import { getLink, getCurrentStationId } from '@/lib/local/link'
import { lastConsolidated } from '@/lib/local/consolidate'
import { useLicence, PaidNote, UnlockActions } from '@/components/desktop/LicenceGate'
import PendingChanges from '@/components/desktop/PendingChanges'

/**
 * Top-of-hub card: the one accent surface on the page, solid brand blue with white text. The
 * station's initial on a round badge beside its name, Push and Pull as round white buttons on
 * the right, the sync state as the main line, and a lighter band at the bottom with the last
 * push and pull as chips (and Review, when there are changes).
 *
 * Desktop build: the records live on this computer, and Push and Pull move them between it and
 * the station on the web (lib/local/webSync.js). The hero figure is how many changes this
 * computer has that the web does not have yet. Review lists them, to discard the ones that
 * should not go to the web (components/desktop/PendingChanges.js).
 *
 * Push and Pull need the computer linked and a subscription running (LicenceGate `paid`):
 * without them the buttons are off and a note under the card says how to unlock them. With
 * them, components/desktop/AutoSync.js also pushes and pulls on its own while online.
 */
// The count on the round Push button: a dark blue dot on its corner.
const COUNT_PIP = 'absolute -top-1 -right-1 bg-primary-800 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center' // design-exception

function when(iso) {
  if (!iso) return 'never'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function StationWallet({ station, pendingCount = 0, syncing, refreshing, onPush, onPull, onDiscarded }) {
  const [reviewing, setReviewing] = useState(false)
  // The link carries the last push, pull and sync error, which the automatic sync updates.
  const [link, setLink] = useState(getLink)
  useEffect(() => {
    const update = () => setLink(getLink())
    window.addEventListener('stationmgr:link', update)
    return () => window.removeEventListener('stationmgr:link', update)
  }, [])
  const paid = Boolean(useLicence()?.paid)
  // A station on this computer only consolidates its old entries here (lib/local/consolidate.js).
  const consolidated = lastConsolidated(getCurrentStationId())
  // Before linking there is no web station to be behind: the count would mean nothing yet.
  const upToDate = !link || pendingCount === 0
  // On the blue: Push and Pull are round white buttons; the band's chips are white-on-blue.
  const roundBtn = 'relative flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-full bg-white text-primary-600 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
  const chip = 'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-house bg-white/20 text-white'

  return (
    <>
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
          <button onClick={onPush} disabled={!paid || syncing || upToDate} className={roundBtn} aria-label="Push" title="Push">
            {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUpFromLine className="w-5 h-5" />}
            {!upToDate && <span className={COUNT_PIP}>{pendingCount > 9 ? '9+' : pendingCount}</span>}
          </button>
          <button onClick={onPull} disabled={!paid || refreshing} className={roundBtn} aria-label="Pull" title="Pull">
            {refreshing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownToLine className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-1.5 text-xs text-white uppercase tracking-wide mb-0.5">
          {upToDate ? <HardDrive className="w-3.5 h-3.5" /> : <CloudUpload className="w-3.5 h-3.5" />}
          {upToDate ? 'Saved on this computer' : 'Waiting to push'}
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white">
          {!link ? 'Works offline' : upToDate ? 'Nothing to push' : `${pendingCount} change${pendingCount === 1 ? '' : 's'} to push`}
        </p>
      </div>

      {/* The lighter band: when it last moved, and what to know. */}
      <div className="mx-2 mb-2 px-3 py-2 bg-white/15 rounded-house flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {link ? (
            <>
              <span className={chip}><Clock className="w-3.5 h-3.5" />Pushed {when(link.lastPushAt)}</span>
              <span className={chip}><Clock className="w-3.5 h-3.5" />Pulled {when(link.lastPullAt)}</span>
            </>
          ) : (
            <span className={chip}>Not linked to a station on the web</span>
          )}
          {!link && consolidated && (consolidated.error ? (
            <span className={chip}>Consolidation failed: {consolidated.error}</span>
          ) : (
            <span className={chip} title={`Entries before ${consolidated.cutoff} were rolled into the opening balances, then removed`}>
              <Clock className="w-3.5 h-3.5" />Old entries consolidated {when(consolidated.at)}
            </span>
          ))}
          {!upToDate && (
            <button onClick={() => setReviewing(true)} disabled={syncing} className={`${chip} hover:bg-white/30 disabled:opacity-40`}>Review</button>
          )}
        </div>
        <p className="text-xs text-white/80 min-w-0">
          {paid
            ? link?.syncError
              ? `Last sync failed: ${link.syncError}`
              : 'Syncs with the web on its own while online. Everything else works offline.'
            : 'Push and Pull need the internet. Everything else works offline.'}
        </p>
      </div>
    </div>
    <PendingChanges open={reviewing} onClose={() => setReviewing(false)} stationId={station.id} onDiscarded={onDiscarded} />
    {!paid && <div className="mb-4"><PaidNote what="Push and Pull" verb="need" /></div>}
    {paid && link?.revoked && (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3 border border-line rounded-house bg-subtle">
        <p className="text-[15px] text-content">This computer was unlinked from its station on the web, so it no longer syncs.</p>
        <UnlockActions compact />
      </div>
    )}
    </>
  )
}
