'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from '@/lib/nav'
import Link from '@/lib/nav'
import {
  Loader2, Fuel, Settings, Mail, LogOut,
  FileSpreadsheet, ClipboardList, CreditCard, Droplets, Users,
  ChevronRight, ChevronDown, BarChart3, Plus, Pencil, Trash2, AlertTriangle,
  FileText, BookOpen, ShieldX, Lock, Truck, Wallet, TrendingUp, Boxes, LineChart, Activity
} from 'lucide-react'
import { homeReports } from '@/lib/recentReports'
import { useLiveQuery } from 'dexie-react-hooks'
import Modal from '@/components/Modal'
import { differenceInDays } from 'date-fns'
import { db } from '@/lib/db'
import { processQueue, clearQueue } from '@/lib/sync'
import { initialSync } from '@/lib/initialSync'
import { supabase } from '@/lib/supabaseClient'
import StationWallet from '@/components/StationWallet'
import { ThemeControl } from '@/design'
import {
  OUTLINE, INPUT, BTN_DANGER, BTN_PRIMARY, BTN_FRAMED, CARD_HOVER, CARD,
  Button, SectionHeader, RowGroup, Row, IconChip,
} from '@/components/ui'
import {
  ENTRY_LINKS, REPORT_SECTIONS, ALL_PAGE_KEYS, canAccessPage,
  ENTRY_PERMISSION_OPTIONS as ENTRY_PAGE_OPTIONS,
  REPORT_PERMISSION_OPTIONS as REPORT_PAGE_OPTIONS,
} from '@/lib/stationNav'

export default function StationPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId

  const [loading, setLoading] = useState(true)
  const [station, setStation] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [user, setUser] = useState(null)

  // Staff invite state
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [expandedStaff, setExpandedStaff] = useState(null)

  // Delete staff modal
  const [deleteModal, setDeleteModal] = useState(null) // { id, email }
  const [deleting, setDeleting] = useState(false)

  // Staff page access
  const [visiblePages, setVisiblePages] = useState(ALL_PAGE_KEYS) // default: all visible
  const [accessDeniedModal, setAccessDeniedModal] = useState(false)
  // A platform admin in someone else's station: not the owner, not a member.
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  // Staff tapping Subscription: the button is shown to everyone, but only an owner can act.
  const [ownerOnlyModal, setOwnerOnlyModal] = useState(false)

  // Subscription (owner only)
  const [subscription, setSubscription] = useState(null)

  // Manage station accordion

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const [syncModal, setSyncModal] = useState(null) // { title, lines[] }
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  const pendingCount = useLiveQuery(
    () => stationId ? db.syncQueue.where('orgId').equals(stationId).count() : 0,
    [stationId],
    0
  )

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    const before = await db.syncQueue.where('orgId').equals(stationId).count()
    let result = { pushed: 0, dropped: 0, pending: 0, errors: [] }
    try { result = await processQueue() || result } catch (e) { /* offline */ }
    const lines = []
    if (before === 0) lines.push('Queue was empty — nothing to push')
    if (result.pushed > 0) lines.push(`${result.pushed} item${result.pushed > 1 ? 's' : ''} pushed successfully`)
    if (result.dropped > 0) lines.push(`${result.dropped} item${result.dropped > 1 ? 's' : ''} rejected by server`)
    if (result.pending > 0) lines.push(`${result.pending} item${result.pending > 1 ? 's' : ''} still pending`)
    if (result.errors.length > 0) {
      lines.push('')
      lines.push('Errors:')
      result.errors.forEach(e => lines.push(`• ${e}`))
    }
    if (result.pushed > 0 && result.dropped === 0 && result.pending === 0) lines.push('All synced!')
    setSyncModal({ title: 'Push Results', lines })
    setSyncing(false)
  }

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current || !stationId) return
    setRefreshing(true)
    refreshingRef.current = true
    const tables = ['dailySales', 'productReceipts', 'lodgements', 'lubeSales', 'lubeStock', 'customerPayments']
    let syncResult = null
    try {
      syncResult = await initialSync(stationId, { force: true })
    } catch (e) { /* offline */ }
    const lines = []
    for (const t of tables) {
      const local = await db[t].where('orgId').equals(stationId).count()
      const server = syncResult?.serverCounts?.[t] ?? '?'
      const label = t.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())
      lines.push(`${label}: ${server} from server → ${local} local`)
    }
    setSyncModal({ title: 'Pull Results', lines })
    setRefreshing(false)
    refreshingRef.current = false
  }, [stationId])

  const handleClearQueue = async () => {
    setClearing(true)
    try {
      const result = await clearQueue(stationId)
      const lines = []
      if (result.cleared === 0) {
        lines.push('Queue was already empty.')
      } else {
        lines.push(`${result.cleared} queued item${result.cleared > 1 ? 's' : ''} cleared`)
        if (result.reverted > 0) {
          lines.push(`${result.reverted} unsaved entr${result.reverted > 1 ? 'ies' : 'y'} removed from local data`)
        }
        lines.push('', 'Pull from server to restore your data.')
      }
      setSyncModal({ title: 'Queue Cleared', lines })
    } catch {
      setSyncModal({ title: 'Error', lines: ['Failed to clear queue.'] })
    }
    setClearing(false)
    setClearConfirm(false)
  }

  useEffect(() => {
    const load = async () => {
      // Asked for by id, which routes through hasStationAccess and so admits owners, accepted
      // members AND platform admins. The list form returns only owned + member stations, so an
      // admin found nothing here, was pushed to /dashboard, and pushed on to /admin from
      // there: a closed loop with no way into any station. The setup wizard and the sidebar
      // already used the by-id form; this brings the hub in line.
      const [orgRes, userRes] = await Promise.all([
        fetch(`/api/organizations?org_id=${encodeURIComponent(stationId)}`),
        fetch('/api/auth/me'),
      ])
      if (!orgRes.ok) { router.push('/dashboard'); return }
      const data = await orgRes.json()
      const s = (data.stations || [])[0]
      if (!s) { router.push('/dashboard'); return }

      const me = userRes.ok ? (await userRes.json()).user : null
      setUser(me)
      setStation(s)

      // Ownership comes from the row, not from which array it arrived in. The by-id form
      // returns the station under `stations` whoever is asking, so the old `!!owned` would
      // have made every admin an owner and handed them Staff and the owner's other controls
      // on a station that is not theirs.
      const owned = !!me?.id && s.owner_id === me.id
      setIsOwner(owned)
      // Access was granted, so the viewer is the owner, an accepted member, or an admin.
      // Knowing which of the last two matters: the controls below act on membership.
      setIsPlatformAdmin(!owned && me?.role === 'admin')

      if (owned) {
        const [invRes, dashRes] = await Promise.all([
          fetch(`/api/invites/list?org_id=${stationId}`),
          fetch(`/api/dashboard/data?org_id=${stationId}`),
        ])
        if (invRes.ok) {
          const invData = await invRes.json()
          setInvites(invData.invites || [])
        }
        if (dashRes.ok) {
          const dashData = await dashRes.json()
          setSubscription(dashData.subscription || null)
        }
      } else {
        // Staff — fetch their visible_pages
        const permRes = await fetch(`/api/invites?org_id=${stationId}`)
        if (permRes.ok) {
          const permData = await permRes.json()
          if (permData.visiblePages) setVisiblePages(permData.visiblePages)
        }
      }
      setLoading(false)
    }
    load()
  }, [stationId, router])

  const loadInvites = async () => {
    const res = await fetch(`/api/invites/list?org_id=${stationId}`)
    if (res.ok) {
      const data = await res.json()
      setInvites(data.invites || [])
    }
  }

  const addInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')
    const res = await fetch('/api/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: stationId, email: inviteEmail }),
    })
    if (res.ok) {
      setShowInviteModal(false)
      setInviteEmail('')
      loadInvites()
    } else {
      const err = await res.json().catch(() => ({}))
      setInviteError(err.error || 'Failed to invite staff')
    }
    setInviting(false)
  }

  const confirmRemoveInvite = async () => {
    if (!deleteModal) return
    setDeleting(true)
    const res = await fetch('/api/invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deleteModal.id }),
    })
    if (res.ok) {
      setDeleteModal(null)
      loadInvites()
    }
    setDeleting(false)
  }

  const togglePagePermission = async (inviteId, pageKey, currentPages) => {
    const updated = currentPages.includes(pageKey)
      ? currentPages.filter((p) => p !== pageKey)
      : [...currentPages, pageKey]
    setInvites((prev) => prev.map((inv) =>
      inv.id === inviteId ? { ...inv, visible_pages: updated } : inv
    ))
    await fetch('/api/invites/permissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId, visible_pages: updated }),
    })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  const canAccess = (pageKey) => canAccessPage(pageKey, { isOwner, visiblePages })

  const entryLinks = ENTRY_LINKS(stationId)
  const reportSections = REPORT_SECTIONS(stationId)
  const reportLinks = reportSections.flatMap((s) => s.items)

  /** Staff (owner only): a full-width panel of its own under Reports, like the Entries one. */
  const staffSection = isOwner ? (
    <section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">
      <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">Staff</h2>
      <div>
          <button
            onClick={() => { setShowInviteModal(true); setInviteEmail(''); setInviteError('') }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium mb-4 ${BTN_PRIMARY}`}
          >
            <Plus className="w-4 h-4" /> Invite Staff
          </button>

          {/* Rows inside the box, not cards. Each invite carried its own CARD, which nested a
              bordered box inside a bordered box once Staff became one. Divided rows are what
              RowGroup does beside this. The negative margins let the run meet the box's edges,
              with a rule above it separating the list from the Invite button. */}
          {invites.length > 0 && (
            <div className="-mx-3 -mb-3 border-t border-primary-500/40 dark:border-primary-400/40 divide-y divide-line">
              {invites.map((inv) => {
                const isExpanded = expandedStaff === inv.id
                const pages = inv.visible_pages || []
                return (
                  <div key={inv.id}>
                    {/* Staff header row */}
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 bg-primary-50 dark:bg-primary-950/40 rounded-full flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-content truncate">{inv.email}</p>
                          <span className={`inline-block text-sm px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                            inv.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                            inv.status === 'declined' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {inv.status}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedStaff(isExpanded ? null : inv.id)}
                        className="p-2 text-content-faint hover:text-content-muted"
                        title="Page access"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expanded: page permissions + delete */}
                    {isExpanded && (
                      <div className="border-t border-line px-3 py-3 bg-subtle">
                        <p className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-2">Entries</p>
                        <div className="space-y-2 mb-3">
                          {ENTRY_PAGE_OPTIONS.map((page) => (
                            <label key={page.key} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={pages.includes(page.key)}
                                onChange={() => togglePagePermission(inv.id, page.key, pages)}
                                className="rounded border-line text-primary-600 focus:ring-primary-500 w-4 h-4"
                              />
                              <span className="text-sm text-content-strong">{page.label}</span>
                            </label>
                          ))}
                        </div>
                        <p className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-2">Reports</p>
                        <div className="space-y-2 mb-4">
                          {REPORT_PAGE_OPTIONS.map((page) => (
                            <div key={page.key}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={page.children
                                    ? page.children.every(c => pages.includes(c.key))
                                    : pages.includes(page.key)
                                  }
                                  ref={page.children ? (el) => {
                                    if (el) el.indeterminate = page.children.some(c => pages.includes(c.key)) && !page.children.every(c => pages.includes(c.key))
                                  } : undefined}
                                  onChange={() => {
                                    if (page.children) {
                                      const allChecked = page.children.every(c => pages.includes(c.key))
                                      const childKeys = page.children.map(c => c.key)
                                      const base = pages.filter(p => !childKeys.includes(p) && p !== page.key)
                                      const updated = allChecked ? base : [...base, page.key, ...childKeys]
                                      setInvites((prev) => prev.map((i) => i.id === inv.id ? { ...i, visible_pages: updated } : i))
                                      fetch('/api/invites/permissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invite_id: inv.id, visible_pages: updated }) })
                                    } else {
                                      togglePagePermission(inv.id, page.key, pages)
                                    }
                                  }}
                                  className="rounded border-line text-primary-600 focus:ring-primary-500 w-4 h-4"
                                />
                                <span className="text-sm text-content-strong">{page.label}</span>
                              </label>
                              {page.children && (
                                <div className="ml-6 mt-1 space-y-1">
                                  {page.children.map((child) => (
                                    <label key={child.key} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={pages.includes(child.key)}
                                        onChange={() => {
                                          const updated = pages.includes(child.key)
                                            ? pages.filter(p => p !== child.key)
                                            : [...pages, child.key]
                                          // Also ensure parent key is present if any child is checked
                                          const hasChild = page.children.some(c => updated.includes(c.key))
                                          const withParent = hasChild && !updated.includes(page.key) ? [...updated, page.key] : hasChild ? updated : updated.filter(p => p !== page.key)
                                          setInvites((prev) => prev.map((i) => i.id === inv.id ? { ...i, visible_pages: withParent } : i))
                                          fetch('/api/invites/permissions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invite_id: inv.id, visible_pages: withParent }) })
                                        }}
                                        className="rounded border-line text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                                      />
                                      <span className="text-xs text-content-muted">{child.label}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setDeleteModal({ id: inv.id, email: inv.email })}
                          className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${BTN_DANGER}`}
                        >
                          <Trash2 className="w-4 h-4" /> Remove Staff
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>
    </section>
  ) : null

  return (
    // station-bold: every word on the station home a step bolder (app/globals.css).
    <div className="station-bold min-h-screen bg-canvas">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8">

        {!isOwner && (
          <p className="text-xs text-content-faint mb-2">You&apos;re a staff member of this station.</p>
        )}

        {/* The one accent surface, in the slot store-portal's BusinessWallet occupies. It also
            absorbs the station identity and the sync controls, which used to sit above it as a
            bare heading and a floating button row. */}
        <StationWallet
          station={station}
          pendingCount={pendingCount}
          syncing={syncing}
          refreshing={refreshing}
          onPush={handleSync}
          onPull={handleRefresh}
          onClear={() => setClearConfirm(true)}
        />

        <div className="flex items-center justify-between gap-2 mb-4">
          {/* /dashboard redirects an admin to /admin, so for them this button flashed through
              two redirects to land somewhere it did not name. Point it where it goes. */}
          <Button
            href={isPlatformAdmin ? '/admin/settings' : '/dashboard'}
            icon={Fuel}
            iconClass="w-5 h-5"
          >
            {isPlatformAdmin ? 'All Stations (admin)' : 'All Stations'}
          </Button>
          {/* Notifications is not here: the sidebar carries the bell, with its unread badge,
              on every screen. This slot goes to the subscription instead, which is where the
              status block that used to sit at the foot of this page now lives.

              Shown to everyone, not just the owner. Hiding it left staff with no explanation
              for why a station they work at has no subscription anywhere on screen; a button
              that says who to ask is more use than a missing one. For staff it opens a message
              instead of the page, since the subscribe form lists owned stations only and would
              be empty for them anyway. */}
          <Button
            href={isOwner ? `/dashboard/subscribe?org_id=${stationId}` : undefined}
            onClick={isOwner ? undefined : () => setOwnerOnlyModal(true)}
            icon={CreditCard}
            iconClass="w-5 h-5"
          >
            Subscription
          </Button>
        </div>

      {/* Expired subscription notice (non-dismissable) */}
      {isOwner && subscription?.status === 'expired' && subscription?.end_date && (() => {
        const daysSinceExpiry = differenceInDays(new Date(), new Date(subscription.end_date))
        const graceRemaining = 7 - daysSinceExpiry
        return (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-3 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {graceRemaining > 0 ? (
                <>
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">Your subscription has expired</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{graceRemaining} day{graceRemaining !== 1 ? 's' : ''} of grace period remaining. Subscribe now to continue adding entries.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-red-800 dark:text-red-200 font-medium">Subscription &amp; grace period expired</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">You can no longer add entries. Subscribe now to resume.</p>
                </>
              )}
            </div>
            <Link href={`/dashboard/subscribe?org_id=${stationId}`} className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium ${BTN_DANGER}`}>Subscribe</Link>
          </div>
        )
      })()}

        {/* Expired subscription notice (non-dismissable) */}
        {isOwner && subscription?.status === 'expired' && subscription?.end_date && (() => {
          const daysSinceExpiry = differenceInDays(new Date(), new Date(subscription.end_date))
          const graceRemaining = 7 - daysSinceExpiry
          return (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 px-4 py-3 mb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {graceRemaining > 0 ? (
                  <>
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">Your subscription has expired</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{graceRemaining} day{graceRemaining !== 1 ? 's' : ''} of grace period remaining. Subscribe now to continue adding entries.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-red-800 dark:text-red-200 font-medium">Subscription &amp; grace period expired</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">You can no longer add entries. Subscribe now to resume.</p>
                  </>
                )}
              </div>
              <Link href={`/dashboard/subscribe?org_id=${stationId}`} className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium ${BTN_DANGER}`}>Subscribe</Link>
            </div>
          )
        })()}

        {/* Entries as widgets in a full-width white panel with its heading inside: pale tiles with
            no line, 96px tall (112px in the Android app), filling the row in equal columns (at
            least 9rem each, wrapping on a phone), a solid blue round chip with a white icon on top,
            the name and a short description under it. A
            destination the member cannot open stays on the board, dimmed, and explains itself on
            tap rather than disappearing. */}
        {entryLinks.length > 0 && (
          <section className="w-full bg-surface border-card border-line rounded-house p-3">
            <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">Entries</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
              {entryLinks.map((link) => {
                const allowed = canAccess(link.pageKey)
                const cls = `w-full h-28 compact:h-24 flex flex-col items-center justify-center gap-1 p-2 text-center bg-subtle rounded-house transition-colors ${allowed ? 'hover:bg-primary-500/10' : 'opacity-50'}`
                const inner = (
                  <>
                    <IconChip icon={link.icon} className="w-10 h-10" iconClass="w-5 h-5" variant="solid" />
                    <p className="text-sm font-medium text-content leading-tight">{link.label}</p>
                    <p className="text-xs text-content-muted leading-snug line-clamp-2">{link.desc}</p>
                  </>
                )
                return allowed ? (
                  <Link key={link.href} href={link.href} className={cls}>{inner}</Link>
                ) : (
                  <button
                    key={link.href}
                    type="button"
                    onClick={() => setAccessDeniedModal(true)}
                    className={`${cls} w-full`}
                  >
                    {inner}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Reports: the ones this person opened most recently here first (lib/recentReports.js),
            only ones they may open. The website keeps four reports, so all of them show and
            there is no "View all". Full width, like the Staff panel under it. */}
        <section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">
          <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">Reports</h2>
          <div className="grid grid-cols-2 gap-3">
            {homeReports(reportLinks, stationId, canAccess).map((link) => (
              <Widget key={link.href} href={link.href} icon={link.icon} label={link.label} desc={link.desc} />
            ))}
          </div>
        </section>

        {staffSection}

      {/* The very bottom: Appearance and Sign out on one plain footer row. Leave Station is in
          Settings, in the Station tab. */}
      <footer className="mt-8 pt-4 border-t border-line flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">Appearance</span>
          {/* One button stepping Light, Dark, System. */}
          <ThemeControl cycle />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </footer>
      </div>

      {/* Invite Staff Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); setInviteError('') }}
        title="Invite Staff"
      >
        <form onSubmit={addInvite} className="space-y-4">
          <p className="text-sm text-content-muted">
            Enter the email of the person you want to invite. They will see the invite on their dashboard after signing up or logging in.
          </p>
          <div>
            <label className="block text-sm font-medium text-content-strong mb-1">Staff Email</label>
            <input
              type="email"
              placeholder="staff@email.com"
              maxLength={254}
              value={inviteEmail}
              onChange={(e) => { setInviteEmail(e.target.value); setInviteError('') }}
              className={INPUT}
              autoFocus
            />
          </div>
          {inviteError && <p className="text-sm text-red-600 dark:text-red-400">{inviteError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowInviteModal(false); setInviteError('') }}
              className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_PRIMARY}`}
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Invite
            </button>
          </div>
          <p className="text-sm text-content-faint">
            Not signed up yet? Share the <Link href="/auth/register" className="text-primary-600 underline">signup link</Link> with them.
          </p>
        </form>
      </Modal>

      {/* Delete Staff Modal */}
      <Modal
        open={!!deleteModal}
        onClose={() => setDeleteModal(null)}
        title="Remove Staff"
      >
        {deleteModal && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-100">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">This action cannot be undone</p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  You are about to remove <strong>{deleteModal.email}</strong> from this station. They will lose access immediately.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteModal(null)}
                className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveInvite}
                disabled={deleting}
                className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_DANGER}`}
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Clear Queue Confirmation Modal */}
      <Modal open={clearConfirm} onClose={() => setClearConfirm(false)} title="Clear Pending Items?">
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-content-strong">
              <p className="font-medium mb-1">This will:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Remove all {pendingCount} pending item{pendingCount > 1 ? 's' : ''} from the queue</li>
                <li>Delete any new entries that haven&apos;t been pushed yet</li>
              </ul>
              <p className="mt-2 text-content-muted">You can pull from the server afterwards to restore your data.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setClearConfirm(false)}
              className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}
            >
              Cancel
            </button>
            <button
              onClick={handleClearQueue}
              disabled={clearing}
              className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_DANGER}`}
            >
              {clearing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Clear Queue
            </button>
          </div>
        </div>
      </Modal>

      {/* Sync Result Modal */}
      <Modal open={!!syncModal} onClose={() => setSyncModal(null)} title={syncModal?.title || 'Sync'}>
        <div className="space-y-2">
          {syncModal?.lines.map((line, i) => (
            <p key={i} className="text-sm text-content-strong">{line}</p>
          ))}
          <button onClick={() => setSyncModal(null)} className={`w-full mt-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>
            OK
          </button>
        </div>
      </Modal>

      {/* Owner-only Modal: staff tapped Subscription. Says who can act rather than what is
          forbidden, because the point is to tell them where to go next. */}
      <Modal open={ownerOnlyModal} onClose={() => setOwnerOnlyModal(false)} title="Owner only">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-300 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Only the station owner can view or change this station&apos;s subscription. Ask
              them if something needs renewing.
            </p>
          </div>
          <button
            onClick={() => setOwnerOnlyModal(false)}
            className={`w-full py-2 text-sm font-medium ${OUTLINE} hover:bg-primary-500/20`}
          >
            OK
          </button>
        </div>
      </Modal>

      {/* Access Denied Modal */}
      <Modal open={accessDeniedModal} onClose={() => setAccessDeniedModal(false)} title="Access Denied">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-100 rounded">
            <ShieldX className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">
              You don&apos;t have permission to access this page. Contact the station owner to update your access.
            </p>
          </div>
          <button
            onClick={() => setAccessDeniedModal(false)}
            className={`w-full py-2 text-sm font-medium ${OUTLINE} hover:bg-primary-500/20`}
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  )
}

/**
 * A report widget on the station home: half the panel wide (two a row), pale, a soft blue round
 * icon, the name and a short description under it, like the Entries widgets above it.
 */
function Widget({ href, icon, label, desc }) {
  return (
    <Link href={href} className="w-full h-28 compact:h-24 flex flex-col items-center justify-center gap-1 p-2 text-center bg-subtle rounded-house transition-colors hover:bg-primary-500/10">
      <IconChip icon={icon} className="w-10 h-10" iconClass="w-5 h-5" />
      <p className="text-sm font-medium text-content leading-tight">{label}</p>
      <p className="text-xs text-content-muted leading-snug line-clamp-2">{desc}</p>
    </Link>
  )
}
