'use client'

import { ShieldX } from 'lucide-react'
import { usePageAccess } from '@/lib/hooks/usePageAccess'
import { ReportSkeleton, FormSkeleton } from '@/components/Skeletons'

/**
 * Wraps page content with a permission check.
 * Shows a loading spinner, then either the content or a "no access" message.
 *
 * @param {string} orgId - The station/org ID
 * @param {string} pageKey - The permission key (e.g. 'report-summary', 'imprest')
 * @param {React.ReactNode} children - The page content (can be a render function receiving { isOwner })
 */
export default function AccessGate({ orgId, pageKey, skeleton, children }) {
  const { loading, allowed, isOwner } = usePageAccess(orgId, pageKey)

  if (!orgId) return null

  // A placeholder in the screen's shape while access is checked: `skeleton`, or a report's or
  // an entry form's by the key.
  if (loading) return skeleton || (pageKey.startsWith('report') || pageKey === 'imprest' ? <ReportSkeleton /> : <FormSkeleton />)

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <ShieldX className="w-10 h-10 text-content-faint mb-3" />
        <h2 className="text-lg font-semibold text-content mb-1">Access Restricted</h2>
        <p className="text-sm text-content-muted max-w-xs">
          You don&apos;t have permission to view this page. Contact the station owner to update your access.
        </p>
      </div>
    )
  }

  // Support render function pattern: children({ isOwner })
  if (typeof children === 'function') {
    return children({ isOwner })
  }

  return children
}
