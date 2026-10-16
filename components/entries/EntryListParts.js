'use client'

import Link from '@/lib/nav'
import { useRouter } from '@/lib/nav'
import { IonIcon } from '@ionic/react'
import { addOutline, chevronForward, cloudOfflineOutline, documentTextOutline, lockClosedOutline } from 'ionicons/icons'
import { Button, EmptyState, Pager } from '@/design'
import { ENTRY_LINE } from '@/components/ui'
import { fmtDate } from '@/lib/formatDate'

/**
 * The parts of the entry lists (the saved days of one entry type). Kept apart from
 * EntryParts.js, which carries the date picker the lists do not need.
 */

/* ── Subscription ─────────────────────────────────────────────────────────── */

/** Shown when the station has no subscription for this kind of entry. */
export function SubscribeNotice() {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 mb-4 border-card ${ENTRY_LINE} rounded-house bg-subtle`}>
      <IonIcon icon={lockClosedOutline} className="text-xl text-content-muted shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-content">Subscribe to add entries</p>
        <p className="text-[15px] text-content-muted">You can view existing data, but creating new entries requires an active subscription.</p>
      </div>
      <Link href="/dashboard/subscribe" className="shrink-0 self-center font-semibold text-primary-600 dark:text-primary-400">Subscribe</Link>
    </div>
  )
}

/* ── List screen ──────────────────────────────────────────────────────────── */

/**
 * The list of saved days. "New entry" is pinned to the bottom on a phone, like Save on the
 * form, and sits above the list on a computer.
 */
export function EntryListScreen({ newHref, newDisabled = false, top = null, children }) {
  const router = useRouter()
  const button = (
    <Button
      size="large"
      icon={addOutline}
      disabled={newDisabled}
      onClick={(e) => { e.preventDefault(); router.push(newHref) }}
    >
      New entry
    </Button>
  )
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-4 pb-32 lg:py-8">
      {top}
      <div className="hidden lg:flex justify-end mb-4"><div className="w-48">{button}</div></div>
      {children}
      <div
        className="entry-actionbar lg:hidden fixed inset-x-0 bottom-0 z-30 px-4 pt-3 bg-canvas border-t-2 border-line"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        {button}
      </div>
    </div>
  )
}

/** Nothing saved yet. */
export function EntryListEmpty({ what = 'entries' }) {
  return (
    <EmptyState icon={documentTextOutline} title={`No ${what} yet`}>
      Tap New entry to record the first one.
    </EmptyState>
  )
}

/**
 * One saved day. The whole row opens it: a large target rather than a small Edit button at
 * the far edge. A day with changes still waiting to reach the server says so.
 */
export function DayRow({ href, date, count, noun = 'entry', nounPlural, amount, detail, pending }) {
  const plural = nounPlural || `${noun === 'entry' ? 'entries' : `${noun}s`}`
  return (
    <Link
      href={href}
      className="flex items-center gap-3 min-h-[64px] px-3 py-2.5 hover:bg-subtle active:bg-subtle"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-content">{date && date !== 'no-date' ? fmtDate(date) : 'No date'}</span>
          <span className="text-[15px] text-content-muted">{count} {count === 1 ? noun : plural}</span>
          {amount != null && <span className="ml-auto font-semibold text-content tabular-nums">{amount}</span>}
        </div>
        {detail && <p className="text-[15px] text-content-muted truncate">{detail}</p>}
        {pending && (
          <p className="flex items-center gap-1 text-[13px] text-content-muted">
            <IonIcon icon={cloudOfflineOutline} aria-hidden="true" /> Not synced yet
          </p>
        )}
      </div>
      <IonIcon icon={chevronForward} className="text-xl text-content-faint shrink-0" aria-hidden="true" />
    </Link>
  )
}

/** The rows in one bordered block. */
export function DayRows({ children }) {
  return <div className={`border-card ${ENTRY_LINE} rounded-house divide-y-2 divide-line overflow-hidden`}>{children}</div>
}

/** The house pager over 1-based pages, as the lists count them. */
export function ListPager({ page, totalPages, onPage }) {
  return (
    <div className="mt-4">
      <Pager page={page - 1} pageCount={totalPages} onChange={(p) => onPage(p + 1)} />
    </div>
  )
}
