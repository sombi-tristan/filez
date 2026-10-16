'use client'

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useRemoteChanges } from '@/lib/hooks/useRemoteChanges'
import { initialSync } from '@/lib/initialSync'
import { repairSync } from '@/lib/sync'

/**
 * Keeps the open station's local mirror in step with the server while the dashboard runs.
 * Moved here from the old app/dashboard/layout.js unchanged, reading the station from the
 * live address: ?org_id= on entry and report screens, the path on the station's own screens.
 */
export function stationIdFrom(pathname, search) {
  const inPath = pathname.match(/^\/dashboard\/(?:stations|setup)\/([^/]+)/)
  return new URLSearchParams(search).get('org_id') || (inPath ? inPath[1] : '')
}

export default function BackgroundSync() {
  const { pathname, search } = useLocation()
  const orgId = stationIdFrom(pathname, search)
  useRemoteChanges(orgId)
  const backfillRef = useRef(null) // org currently being backfilled (dedupes re-renders)

  // Full history backfill into the local mirror. Reports are computed in the browser from this
  // mirror, so without a complete download a device only holds the entries it authored plus the
  // ~24h useRemoteChanges polls back, and cumulative/opening-balance figures come out wrong,
  // differently on each device. initialSync is gated by the synced flag + SYNC_VERSION, so this
  // does the heavy pull once (and once more when SYNC_VERSION bumps, healing partial mirrors)
  // and is a cheap no-op afterwards. On a partial/failed sync the flag is left unset, so we
  // clear the ref to allow a retry.
  useEffect(() => {
    if (!orgId || backfillRef.current === orgId) return
    backfillRef.current = orgId
    initialSync(orgId)
      .then((r) => { if (!r || r.complete === false) backfillRef.current = null })
      .catch((e) => { backfillRef.current = null; console.warn('[BackgroundSync] backfill failed, will retry', e?.message) })
  }, [orgId])

  // One-time repair: re-queue lodgements that were dropped due to missing 'transfer' type
  useEffect(() => {
    if (orgId) repairSync('lodgement-repair-v4', 'lodgements', orgId)
  }, [orgId])

  return null
}
