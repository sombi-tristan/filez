'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from '@/lib/nav'
import { Inbox, RefreshCw, Loader2, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { db } from '@/lib/db'
import { fmtDate } from '@/lib/formatDate'
import useStationUnread from '@/lib/useStationUnread'
import { EmptyState, OUTLINE } from '@/components/ui'

/**
 * Notifications — the station's activity inbox. Replaces the chat log.
 *
 * The old screen mixed two different things in one stream: `activity` rows written
 * automatically by lib/entryHelpers.js ("added a lodgement entry"), and `message` rows staff
 * typed to each other. Only the first is a notification, and the second was carrying the
 * weight of being a chat product — mentions, deletes, run-collapsing — inside a log.
 *
 * This shows the activity, in the shape store-portal's Messages inbox uses: a typed chip, a
 * one-line summary, tap to expand, read/unread.
 *
 * The list and the read state come from useStationUnread, which the sidebar item and the
 * header bell also read — see that file for why read state is per device. This screen owns
 * only the presentation: paging, expanding, and the refresh button.
 */

// Chip label + tint per action_type. Unknown types fall back to a neutral "Activity".
const TYPE_META = {
  created_entry:        { label: 'Entry',        chip: 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' },
  updated_entry:        { label: 'Edit',         chip: 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' },
  imprest_period:       { label: 'Imprest',      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  invite_created:       { label: 'Staff',        chip: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  invite_removed:       { label: 'Staff',        chip: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  permissions_changed:  { label: 'Access',       chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  staff_password_reset: { label: 'Access',       chip: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' },
  left_station:         { label: 'Staff',        chip: 'bg-subtle text-content-muted' },
  onboarding_saved:     { label: 'Setup',        chip: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
  subscription_started: { label: 'Subscription', chip: 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' },
}
const FALLBACK = { label: 'Activity', chip: 'bg-subtle text-content-muted' }

// Matches the account ledger's pager. A station that has been running a while accumulates
// thousands of activity rows, and rendering all of them is a slow screen nobody scrolls.
const PAGE_SIZE = 20

export default function NotificationsPage() {
  const params = useParams()
  const stationId = params.stationId

  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [page, setPage] = useState(0)

  const { notices, unread, read, markRead, markAllRead } = useStationUnread(stationId)

  const totalPages = Math.max(1, Math.ceil(notices.length / PAGE_SIZE))

  // Switching station, or refreshing into a shorter list, must not strand the reader on a
  // page that no longer exists.
  useEffect(() => { setPage(0) }, [stationId])
  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1))
  }, [totalPages])

  const paged = useMemo(
    () => notices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [notices, page]
  )

  const refresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch(`/api/chat?org_id=${stationId}`, { cache: 'no-store' })
      if (res.ok) {
        const { messages } = await res.json()
        if (messages?.length) {
          await db.stationMessages.bulkPut(messages.map((m) => ({
            id: m.id, orgId: m.org_id, userId: m.user_id, userName: m.user_name,
            type: m.type, content: m.content, actionType: m.action_type,
            deletedAt: m.deleted_at || null, createdAt: m.created_at,
          })))
        }
      }
    } catch { /* offline — the local mirror is still shown */ }
    setRefreshing(false)
  }

  useEffect(() => { if (stationId) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  const open = (n) => {
    setExpanded(expanded === n.id ? null : n.id)
    markRead(n.id)
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-content">Notifications</h1>
          <p className="text-sm text-content-muted">
            {unread > 0 ? `${unread} unread` : 'Everything read'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <button onClick={markAllRead} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${OUTLINE} hover:bg-primary-500/20`}>
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          <button onClick={refresh} disabled={refreshing} aria-label="Refresh"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${OUTLINE} hover:bg-primary-500/20`}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {notices.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing yet">
          Entries, staff changes and subscription events show up here.
        </EmptyState>
      ) : (
        <div className="border-card border-primary-500/40 dark:border-primary-400/40 divide-y divide-line">
          {paged.map((n) => {
            const meta = TYPE_META[n.actionType] || FALLBACK
            const isRead = read.has(n.id)
            const isOpen = expanded === n.id
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className="w-full text-left px-3 py-3 hover:bg-subtle transition-colors block"
              >
                <div className="flex items-center gap-2">
                  {/* An unread marker rather than a bold row: bold on a dense list reads as
                      emphasis on the words, not as "new". */}
                  <span aria-hidden className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRead ? 'bg-transparent' : 'bg-primary-500'}`} />
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 shrink-0 ${meta.chip}`}>{meta.label}</span>
                  <span className={`text-sm flex-1 min-w-0 truncate ${isRead ? 'text-content-muted' : 'text-content font-medium'}`}>
                    {n.userName ? `${n.userName} ` : ''}{n.content}
                  </span>
                  <span className="text-[11px] text-content-faint shrink-0">{fmtDate(n.createdAt)}</span>
                </div>
                {isOpen && (
                  <p className="text-sm text-content-muted mt-2 pl-6">
                    {n.content}
                    {n.userName ? ` — ${n.userName}` : ''}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed ${OUTLINE} hover:bg-primary-500/20`}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-content-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed ${OUTLINE} hover:bg-primary-500/20`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
