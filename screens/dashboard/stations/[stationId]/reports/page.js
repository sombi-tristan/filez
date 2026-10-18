'use client'

import { useEffect, useState } from 'react'
import { useParams } from '@/lib/nav'
import { Loader2, ShieldX } from 'lucide-react'
import Modal from '@/components/Modal'
import ReportGroups from '@/components/station/ReportGroups'
import { usePageAccess } from '@/lib/hooks/usePageAccess'
import { REPORT_SECTIONS, canAccessPage } from '@/lib/stationNav'
import { BTN_FRAMED } from '@/components/ui'

/**
 * Every report for a station, in its groups: what the station home's "View all" widget opens.
 * Reports the person may not open are dimmed and explain themselves on tap; Rainoil-only ones
 * are listed only for a station in that group.
 */
export default function StationReportsPage() {
  const { stationId } = useParams()
  // The person's own access: owner, or the pages their invite lets them open.
  const { loading, isOwner, visiblePages } = usePageAccess(stationId, 'report-summary')
  const [station, setStation] = useState(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/organizations?org_id=${encodeURIComponent(stationId)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => { if (alive) setStation((data.stations || [])[0] || {}) })
      .catch(() => { if (alive) setStation({}) })
    return () => { alive = false }
  }, [stationId])

  if (loading || !station) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>
  }

  const canAccess = (pageKey) => canAccessPage(pageKey, { isOwner, visiblePages })
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-3 pb-10">
      <ReportGroups sections={REPORT_SECTIONS(stationId, station?.station_group)} canAccess={canAccess} onBlocked={() => setBlocked(true)} />

      <Modal open={blocked} onClose={() => setBlocked(false)} title="Access Denied">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 rounded-house">
            <ShieldX className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              You don&apos;t have permission to access this page. Contact the station owner to update your access.
            </p>
          </div>
          <button onClick={() => setBlocked(false)} className={`w-full py-2 text-sm font-medium ${BTN_FRAMED}`}>OK</button>
        </div>
      </Modal>
    </div>
  )
}
