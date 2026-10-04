'use client'

import { HardDrive, Loader2 } from 'lucide-react'

/**
 * Top-of-hub card: the one accent surface on the page — solid brand blue, white text.
 *
 * Desktop build: there is no server to push to or pull from, so the sync controls and the
 * server's weekly consolidation countdown are gone. What is left says where the records live.
 * `pendingCount` is the handful of just-saved entries still being written into the station's
 * records; it clears by itself within seconds.
 */
export default function StationWallet({ station, pendingCount = 0 }) {
  return (
    <div className="relative bg-primary-600 text-white border-card border-primary-500/40 dark:border-primary-400/40 mb-4">
      <div className="relative p-3">
        <h1 className="text-sm font-semibold text-white truncate mb-1">{station.name}</h1>
        {(station.location || station.station_group) && (
          <p className="text-xs text-white/80 truncate mb-1">
            {[station.location, station.station_group].filter(Boolean).join(' · ')}
          </p>
        )}
        <p className="flex items-center gap-2 text-lg sm:text-xl font-bold text-white mt-1">
          {pendingCount > 0
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving {pendingCount}…</>
            : <><HardDrive className="w-5 h-5" /> Saved on this computer</>}
        </p>
      </div>
    </div>
  )
}
