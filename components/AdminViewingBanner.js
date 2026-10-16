'use client'

import { useState, useEffect } from 'react'
import Link from '@/lib/nav'
import { useParams, useSearchParams } from '@/lib/nav'
import { ShieldAlert } from 'lucide-react'

/**
 * Tells a platform admin that the station they are in is not theirs.
 *
 * Admins can open any station now (hasStationAccess grants them, and the hub asks for the
 * station by id). Without this the screen is indistinguishable from their own, and the entry
 * and report screens write to a real customer's data with nothing on screen saying so.
 *
 * Renders nothing at all for owners, for staff, and for an admin sitting in a station they
 * happen to own, so the only people who ever see it are the ones it is about.
 *
 * Drawn inside the screen's IonHeader, under the toolbar, so it stays put while the content
 * scrolls beneath it.
 */
export default function AdminViewingBanner() {
  const params = useParams()
  const searchParams = useSearchParams()
  // The station is in the path on the hub and its subpages, and in ?org_id= on every entry
  // and report screen. Same derivation the header and the sidebar use.
  const stationId = params?.stationId || searchParams.get('org_id') || ''

  const [station, setStation] = useState(null)

  useEffect(() => {
    if (!stationId) { setStation(null); return }
    let alive = true
    ;(async () => {
      try {
        const [orgRes, meRes] = await Promise.all([
          fetch(`/api/organizations?org_id=${encodeURIComponent(stationId)}`),
          fetch('/api/auth/me'),
        ])
        if (!alive) return
        const org = orgRes.ok ? (await orgRes.json()).stations?.[0] : null
        const me = meRes.ok ? (await meRes.json()).user : null
        // Both conditions, not just the role: an admin in their own station is simply the
        // owner, and telling them they are trespassing on themselves is noise.
        const viewing = me?.role === 'admin' && org && org.owner_id !== me.id ? org : null
        setStation(viewing)
      } catch {
        // Offline or a failed lookup: say nothing rather than guess at whose station this is.
      }
    })()
    return () => { alive = false }
  }, [stationId])

  if (!station) return null

  return (
    <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 print:hidden">
      <div className="px-4 sm:px-6 py-2 flex items-center gap-2.5 text-sm">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
        <p className="flex-1 min-w-0 text-amber-800 dark:text-amber-200">
          <span className="font-semibold">Admin view.</span>{' '}
          <span className="font-semibold">{station.name}</span> belongs to another account.
          Anything you change here changes their data.
        </p>
        <Link
          href="/admin/settings"
          className="shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-200 underline hover:text-amber-900 dark:hover:text-amber-100"
        >
          Back to admin
        </Link>
      </div>
    </div>
  )
}
