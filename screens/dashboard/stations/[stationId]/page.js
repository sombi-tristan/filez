'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from '@/lib/nav'
import Link from '@/lib/nav'
import {
  Loader2, Fuel, Settings, LogOut,
  FileSpreadsheet, ClipboardList, Droplets, Users,
  ChevronRight, ChevronDown, BarChart3, Plus, Pencil, Trash2, AlertTriangle,
  FileText, BookOpen, ShieldX, Truck, Wallet, TrendingUp, Boxes, LineChart, Activity, LayoutGrid
} from 'lucide-react'
import { homeReports } from '@/lib/recentReports'
import { useLiveQuery } from 'dexie-react-hooks'
import Modal from '@/components/Modal'
import { db } from '@/lib/db'
import { processQueue, clearQueue } from '@/lib/sync'
import { initialSync } from '@/lib/initialSync'
import { store } from '@/lib/local/store'
import { push as webPush, pull as webPull } from '@/lib/local/webSync'
import { setCurrentStationId, allLinks } from '@/lib/local/link'
import { paidNow } from '@/lib/local/licence'
import { pendingCount as countPending } from '@/lib/local/outbox'
import { supabase } from '@/lib/supabaseClient'
import StationWallet from '@/components/StationWallet'
import { ThemeControl } from '@/design'
import ThisComputer from '@/components/ThisComputer'
import {
  OUTLINE, INPUT, BTN_DANGER, BTN_PRIMARY, BTN_FRAMED, CARD_HOVER, CARD,
  Button, SectionHeader, RowGroup, Row, IconChip,
} from '@/components/ui'
import {
  ENTRY_LINKS, REPORT_SECTIONS, ALL_PAGE_KEYS, canAccessPage,
  ENTRY_PERMISSION_OPTIONS as ENTRY_PAGE_OPTIONS,
  reportPermissionOptions,
} from '@/lib/stationNav'

export default function StationPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.stationId

  const [loading, setLoading] = useState(true)
  // Why the station could not be opened, shown here rather than a silent return to sign-in,
  // which looped when the person signed in could not open it (CLAUDE.md, restore)
  const [openError, setOpenError] = useState(null)
  const [station, setStation] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [user, setUser] = useState(null)

  // Staff invite state
  const [invites, setInvites] = useState([])
  const [inviteEmail, setInviteEmail] = useState('') // their StationMGR web account's email
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


  // Manage station accordion

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const refreshingRef = useRef(false)
  const [syncModal, setSyncModal] = useState(null) // { title, lines[] }
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  // This station's changes the web station does not have yet (lib/local/outbox.js). Only its
  // own: other stations' waiting changes are theirs to push, and counting them here made Push
  // look refused.
  const pendingCount = useLiveQuery(() => countPending(stationId, { legacyStationId: allLinks()[0]?.stationId }), [stationId], 0)

  // Desktop build: Push and Pull reach the station on the web (lib/local/webSync.js). Both need
  // the internet; everything else on this screen works without it.
  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    const result = await webPush().catch((e) => ({ ok: false, error: e.message }))
    const lines = []
    if (!result.ok) lines.push(result.error || 'Push failed')
    else if (result.pushed === 0 && !result.refused.length) lines.push('Nothing to push')
    else if (result.pushed > 0) lines.push(`${result.pushed} change${result.pushed > 1 ? 's' : ''} sent to the web station`)
    if (result.refused?.length) {
      lines.push('', `${result.refused.length} not accepted, still waiting here:`)
      result.refused.slice(0, 10).forEach((r) => lines.push(`• ${r.error}`))
    }
    setSyncModal({ title: 'Push', lines })
    setSyncing(false)
  }

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current || !stationId) return
    setRefreshing(true)
    refreshingRef.current = true
    const result = await webPull().catch((e) => ({ ok: false, error: e.message }))
    const lines = []
    if (!result.ok) lines.push(result.error || 'Pull failed')
    else {
      const counts = result.counts || {}
      const label = { daily_sales_entries: 'Daily sales', product_receipt_entries: 'Product receipts', lodgement_entries: 'Lodgements', lube_sales_entries: 'Lube sales', lube_stock_entries: 'Lube stock', customer_payment_entries: 'Account payments' }
      for (const [table, name] of Object.entries(label)) lines.push(`${name}: ${counts[table] ?? 0} on the web`)
      lines.push('', 'Changes still waiting to push were kept as they are on this computer.')
    }
    setSyncModal({ title: 'Pull', lines })
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
      if (orgRes.status === 401) { router.replace('/auth/login'); return }
      const data = await orgRes.json().catch(() => ({}))
      const s = (data.stations || [])[0]
      if (!orgRes.ok || !s) {
        const me = userRes.ok ? (await userRes.json().catch(() => ({}))).user : null
        setOpenError({ status: orgRes.status, error: data.error || 'Station not found', who: me?.name || me?.email || 'nobody' })
        setLoading(false)
        return
      }

      const me = userRes.ok ? (await userRes.json()).user : null
      // The station open now: the licence, a backup and the screens follow it (lib/local/link.js).
      setCurrentStationId(s.id)
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
        const invRes = await fetch(`/api/invites/list?org_id=${stationId}`)
        if (invRes.ok) {
          const invData = await invRes.json()
          setInvites(invData.invites || [])
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
      setInviteError(err.error || 'Failed to add staff')
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
    router.replace('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  if (openError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 space-y-4" role="alert">
        <h1 className="text-xl font-bold text-content">This station could not be opened</h1>
        <p className="text-sm text-content">
          {openError.error} (error {openError.status}). Station <code className="text-xs">{stationId}</code>, signed in as {openError.who}.
        </p>
        <p className="text-sm text-content-muted">
          Sign out and sign in again: if this computer holds another station&apos;s records, sign-in offers to get this
          station back from the web, keep the other one, or create it on the web.
        </p>
        <button onClick={handleSignOut} className={`px-4 py-2 text-sm font-medium ${BTN_PRIMARY}`}>Sign out</button>
      </div>
    )
  }

  const canAccess = (pageKey) => canAccessPage(pageKey, { isOwner, visiblePages })

  const entryLinks = ENTRY_LINKS(stationId)
  const reportSections = REPORT_SECTIONS(stationId, station?.station_group)
  const reportLinks = reportSections.flatMap((s) => s.items)

  /** Staff (owner only): a full-width panel of its own under Reports, like the Entries one. */
  const staffSection = isOwner ? (
    <section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">
      <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">Staff</h2>
      <div>
          <button
            onClick={() => { setShowInviteModal(true); setInviteEmail(''); setStaffName(''); setStaffPin(''); setInviteError('') }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium mb-4 ${BTN_PRIMARY}`}
          >
            <Plus className="w-4 h-4" /> Add Staff
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
                          <Users className="w-4 h-4 text-primary-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-content truncate">{inv.name || inv.email}</p>
                          <p className="text-xs text-content-muted truncate">@{inv.email}</p>
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
                          {reportPermissionOptions(station?.station_group).map((page) => (
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
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setDeleteModal({ id: inv.id, email: inv.name || inv.email })}
                            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium ${BTN_DANGER}`}
                          >
                            <Trash2 className="w-4 h-4" /> Remove Staff
                          </button>
                        </div>
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
          // Discarded changes go back to the web's version: pull now when it can.
          onDiscarded={() => { if (paidNow(stationId) && navigator.onLine) handleRefresh() }}
        />

<div className="mb-4" />

        {/* Entries as widgets in a full-width white panel with its heading inside: pale tiles with
            no line, 96px tall, filling the row in equal columns (at least 9rem each, wrapping on
            a phone), a solid blue round chip with a white icon on top, the name and a short description under it. A
            destination the member cannot open stays on the board, dimmed, and explains itself on
            tap rather than disappearing. */}
        {entryLinks.length > 0 && (
          <section className="w-full bg-surface border-card border-line rounded-house p-3">
            <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">Entries</h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">
              {entryLinks.map((link) => {
                const allowed = canAccess(link.pageKey)
                const cls = `w-full h-24 flex flex-col items-center justify-center gap-1 p-2 text-center bg-subtle rounded-house transition-colors ${allowed ? 'hover:bg-primary-500/10' : 'opacity-50'}`
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

        {/* Reports: the six this person opened most recently here (lib/recentReports.js), only
            ones they may open, two a row, then "View all" as a full-width list card under them,
            opening every report in its groups on the Reports screen. Full width, like the Staff
            panel under it. */}
        <section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">
          <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">Reports</h2>
          <div className="grid grid-cols-2 gap-3">
            {homeReports(reportLinks, stationId, canAccess, 2).map((link) => (
              <Widget key={link.href} href={link.href} icon={link.icon} label={link.label} desc={link.desc} />
            ))}
            <Link href={`/dashboard/stations/${stationId}/reports`} className="col-span-2 flex items-center gap-3 p-3 bg-subtle rounded-house transition-colors hover:bg-primary-500/10">
              <IconChip icon={LayoutGrid} className="w-10 h-10" iconClass="w-5 h-5" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-content">View all reports</span>
                <span className="block text-xs text-content-muted truncate">Every report, in its groups</span>
              </span>
              <ChevronRight className="w-4 h-4 text-content-faint flex-shrink-0" />
            </Link>
          </div>
        </section>

        {staffSection}

      <ThisComputer isOwner={isOwner} stationName={station?.name} />

      {/* The very bottom: Appearance and Sign out on one plain footer row. */}
      <footer className="mt-8 pt-4 border-t border-line flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">Appearance</span>
          {/* One button stepping Light, Dark, System. */}
          <ThemeControl cycle />
        </div>
        <button
          onClick={handleSignOut}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </footer>
      </div>

      {/* Add Staff Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => { setShowInviteModal(false); setInviteError('') }}
        title="Add Staff"
      >
        <form onSubmit={addInvite} className="space-y-4">
          <p className="text-sm text-content-muted">
            They sign in on this computer with their StationMGR web account: this email and their own password. Someone without
            an account creates one at sign-in. Choose what they can open after adding them.
          </p>
          <div>
            <label className="block text-sm font-medium text-content-strong mb-1">Their email</label>
            <input type="email" maxLength={120} value={inviteEmail} autoFocus
              onChange={(e) => { setInviteEmail(e.target.value.trim()); setInviteError('') }} className={INPUT} />
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
              Add
            </button>
          </div>
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
                  You are about to remove <strong>{deleteModal.email}</strong>. They will no longer be able to sign in. Entries they made stay on record.
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
// A report on the station home: an orange tile with an orange round chip (house orange #f57d00),
// the reports' colour there, apart from the blue Entries.
function Widget({ href, icon: Icon, label, desc }) {
  return (
    <Link href={href} className="w-full h-24 flex flex-col items-center justify-center gap-1 p-2 text-center bg-[rgb(245_125_0/0.12)] rounded-house transition-colors hover:bg-[rgb(245_125_0/0.2)]">
      <div className="flex items-center justify-center shrink-0 rounded-full w-10 h-10 bg-[rgb(245_125_0/0.2)] text-[#d86e00] dark:text-[#f68a1a]">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-content leading-tight">{label}</p>
      <p className="text-xs text-content-muted leading-snug line-clamp-2">{desc}</p>
    </Link>
  )
}
