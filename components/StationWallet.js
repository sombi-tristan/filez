'use client'

import { HardDrive, Loader2, ArrowUpFromLine, ArrowDownToLine, CloudUpload } from 'lucide-react'
import { getLink } from '@/lib/local/link'
import { useLicence, PaidNote } from '@/components/desktop/LicenceGate'

/**
 * Top-of-hub card: the one accent surface on the page, solid brand blue with white text.
 *
 * Desktop build: the records live on this computer, and Push and Pull move them between it and
 * the station on the web (lib/local/webSync.js). The hero figure is how many changes this
 * computer has that the web does not have yet. There is no Clear queue here: clearing would
 * throw away changes the web has never seen.
 *
 * Push and Pull need the computer linked and a subscription running (LicenceGate `paid`):
 * without them the buttons are off and a note under the card says how to unlock them.
 */
const COUNT_PIP = 'bg-white/25 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center' // design-exception

function when(iso) {
  if (!iso) return 'never'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function StationWallet({ station, pendingCount = 0, syncing, refreshing, onPush, onPull }) {
  const link = getLink()
  const paid = Boolean(useLicence()?.paid)
  // Before linking there is no web station to be behind: the count would mean nothing yet.
  const upToDate = !link || pendingCount === 0
  // On a filled surface every control is white-on-blue; the app's blue outline would disappear.
  const btn = 'flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-semibold border-2 border-white/40 text-white hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  return (
    <>
    <div className="relative bg-primary-600 text-white border-card border-primary-500/40 dark:border-primary-400/40 mb-4">
      <div className="relative p-3">
        <h1 className="text-sm font-semibold text-white truncate mb-1">{station.name}</h1>
        {(station.location || station.station_group) && (
          <p className="text-xs text-white/80 truncate mb-1">
            {[station.location, station.station_group].filter(Boolean).join(' · ')}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-xs text-white uppercase tracking-wide mb-0.5">
          {upToDate ? <HardDrive className="w-3.5 h-3.5" /> : <CloudUpload className="w-3.5 h-3.5" />}
          {upToDate ? 'Saved on this computer' : 'Waiting to push'}
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white">
          {!link ? 'Works offline' : upToDate ? 'Nothing to push' : `${pendingCount} change${pendingCount === 1 ? '' : 's'} to push`}
        </p>
        <p className="text-sm text-white/90 mt-1">
          {link ? `Last push ${when(link.lastPushAt)} · last pull ${when(link.lastPullAt)}` : 'Not linked to a station on the web'}
        </p>
      </div>

      <div className="relative border-t border-white/30 px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-white/80 min-w-0">Push and Pull need the internet. Everything else works offline.</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onPush} disabled={!paid || syncing || upToDate} className={btn}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
            Push
            {!upToDate && <span className={COUNT_PIP}>{pendingCount > 9 ? '9+' : pendingCount}</span>}
          </button>
          <button onClick={onPull} disabled={!paid || refreshing} className={btn}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
            Pull
          </button>
        </div>
      </div>
    </div>
    {!paid && <div className="mb-4"><PaidNote what="Push and Pull" verb="need" /></div>}
    </>
  )
}
