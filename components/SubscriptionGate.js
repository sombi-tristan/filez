'use client'

import Link from '@/lib/nav'
import { Lock } from 'lucide-react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { ENTRY_SERVICE_MAP } from '@/lib/entryHelpers'
import { OUTLINE } from '@/components/ui'

/**
 * Wraps entry form content. When unsubscribed, renders children as read-only
 * and replaces the save button area with a subscribe prompt.
 *
 * Props:
 *   orgId       - station id
 *   entryType   - key from ENTRY_SERVICE_MAP (e.g. 'daily-sales')
 *   children    - form content (always rendered)
 *   renderAction - (subscribed) => JSX — the save/submit button area
 */
export default function SubscriptionGate({ orgId, entryType, children, renderAction }) {
  const serviceKey = ENTRY_SERVICE_MAP[entryType]
  const { subscribed, loading } = useSubscription(orgId, serviceKey)

  return (
    <>
      {/* Amber stays literal: it is a state colour (waiting/blocked), which the design
          system treats as meaning rather than decoration. Only dark variants are added. */}
      {!loading && !subscribed && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-4 py-3 mb-4 flex items-center gap-3">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Subscribe to add entries</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">You can view existing data, but creating new entries requires an active subscription.</p>
          </div>
          {/* Was a solid blue fill. The system has no solid CTAs — weight comes from how
              hard the outline is drawn. Padding and text size are unchanged. */}
          <Link
            href="/dashboard/subscribe"
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
          >
            Subscribe
          </Link>
        </div>
      )}
      {children}
      {renderAction ? renderAction(subscribed || loading) : null}
    </>
  )
}
