'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePathname, useSearchParams, useParams, useRouter } from 'next/navigation'
import { IonIcon } from '@ionic/react'
import {
  bookOutline, cardOutline, closeOutline, cubeOutline, documentTextOutline, gridOutline,
  homeOutline, logOutOutline, pulseOutline, receiptOutline, settingsOutline, statsChartOutline,
  trendingUpOutline, carOutline, walletOutline, waterOutline, peopleOutline, clipboardOutline,
  analyticsOutline,
} from 'ionicons/icons'
import {
  Sidebar, SidebarBrand, SidebarSwitcher, SidebarGroupLabel, SidebarNavRow, SidebarUserFooter,
  ThemeControl,
} from '@/design'
import { supabase } from '@/lib/supabaseClient'
import { buildStationNav } from '@/lib/stationNav'

/**
 * Section switcher for the pages inside a station, so moving from Daily Sales to Lodgements
 * is one tap instead of Home-then-tile.
 *
 * Built from the house sidebar parts (design/components/Sidebar.jsx): brand, the station you
 * are in (and the way to another), the menu under group labels, and who is signed in. In the
 * neutrals, with the accent only on the row that is open.
 *
 * Two presentations of one list:
 *   lg and up → a persistent column running the full height
 *   below lg  → an overlay drawer from the right, opened by the parent (this one is controlled)
 *
 * The house puts its sidebar in an IonMenu inside an IonSplitPane. That pair needs the whole
 * app inside IonApp/IonContent, which scrolls in a box rather than the document; every screen
 * here scrolls the document (the reports size themselves to the viewport), so the column and
 * drawer stay plain elements and only what is inside them is the house's.
 *
 * It renders buildStationNav(), the same source the station hub reads, so the two cannot
 * offer different destinations. Blocked destinations are shown dimmed rather than hidden,
 * matching the hub: that tells a member the feature exists and who to ask.
 */

/**
 * The house rows take ionicons, the hub's tiles take lucide (lib/stationNav.js), so each
 * destination's sidebar icon is named here by its permission key.
 */
const ICONS = {
  'daily-sales': gridOutline,
  'product-receipt': clipboardOutline,
  lodgements: cardOutline,
  lube: waterOutline,
  'customer-payments': peopleOutline,
  'report-summary': documentTextOutline,
  'report-daily-sales': statsChartOutline,
  'report-sales-operation': pulseOutline,
  'report-sales-overview': trendingUpOutline,
  'report-inventory-log': cubeOutline,
  'report-analytics': analyticsOutline,
  'report-audit': receiptOutline,
  'report-account-ledger': bookOutline,
  'report-product-received': carOutline,
  'report-lube': waterOutline,
  imprest: walletOutline,
}

/**
 * A destination this member may not open: the house row's look, dimmed, and inert. The house
 * row has no disabled state, so this is the one row drawn here rather than by SidebarNavRow.
 */
function BlockedRow({ label, icon }) {
  return (
    <button type="button" className="house-side-row" disabled aria-disabled="true" style={{ opacity: 0.45, cursor: 'not-allowed' }}>
      {icon ? <IonIcon icon={icon} aria-hidden="true" /> : null}
      <span>{label}</span>
    </button>
  )
}

export default function StationSidebar({ open, onClose }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const router = useRouter()

  // The station is in the path on the hub, and in ?org_id= on every entry and report screen.
  const stationId = params?.stationId || searchParams.get('org_id') || ''

  const [isOwner, setIsOwner] = useState(false)
  const [visiblePages, setVisiblePages] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [user, setUser] = useState(null)
  const [stations, setStations] = useState([])

  useEffect(() => {
    if (!stationId) return
    let alive = true
    ;(async () => {
      try {
        // The unscoped list, not ?org_id=: the switcher needs every station this person can
        // reach, and the ownership check below only needs to find the current one inside it.
        const [orgRes, me] = await Promise.all([
          fetch('/api/organizations'),
          fetch('/api/auth/me').then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ])
        if (!alive) return

        const body = orgRes.ok ? await orgRes.json() : {}
        const reachable = [...(body.stations || []), ...(body.memberStations || [])]
        const deduped = [...new Map(reachable.map((s) => [s.id, s])).values()]
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setStations(deduped)
        setUser(me?.user || null)

        const found = deduped.find((s) => String(s.id) === String(stationId)) || null
        setIsOwner(!!found && !!me?.user?.id && found.owner_id === me.user.id)

        // Same endpoint the hub uses. Staff get visible_pages; an owner gets none, which
        // is why isOwner carries the decision instead.
        const perm = await fetch(`/api/invites?org_id=${stationId}`)
          .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        if (alive) setVisiblePages(perm?.visiblePages || null) // null = unrestricted
      } catch { /* offline: the nav still renders, just without permission dimming */ }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId])

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (!stationId) return null

  // visiblePages null means "not restricted", which buildStationNav reads as owner-like.
  const sections = buildStationNav(stationId, { isOwner: isOwner || visiblePages == null, visiblePages })
  const home = `/dashboard/stations/${stationId}`
  const current = stations.find((s) => String(s.id) === String(stationId))

  const isCurrent = (href) => pathname === href.split('?')[0]

  // The house row would navigate with Ionic's router, which this app does not run: it is
  // stopped, and Next's router goes instead.
  const go = (href) => (e) => {
    e.preventDefault()
    onClose?.()
    router.push(href)
  }

  const row = (link) => (link.allowed ? (
    <SidebarNavRow
      key={link.href}
      href={link.href}
      label={link.label}
      icon={ICONS[link.pageKey] || documentTextOutline}
      active={isCurrent(link.href)}
      badge={link.badge}
      onClick={go(link.href)}
    />
  ) : (
    <BlockedRow key={link.href} label={link.label} icon={ICONS[link.pageKey] || documentTextOutline} />
  ))

  const brandMark = (
    <Image src="/icon-192.png" alt="" aria-hidden width={32} height={32} className="w-8 h-8 shrink-0 rounded-house" />
  )

  const body = (
    <Sidebar label="Station">
      <SidebarBrand mark={brandMark} name="StationMGR" />
      <SidebarSwitcher
        title={current?.name || 'Station'}
        subtitle={isOwner ? 'Owner' : 'Staff member'}
        currentId={String(stationId)}
        options={stations.map((s) => ({ id: String(s.id), title: s.name }))}
        onPick={(o) => { if (String(o.id) !== String(stationId)) router.push(`/dashboard/stations/${o.id}`) }}
      />

      <SidebarNavRow href={home} label="Station home" icon={homeOutline} active={pathname === home} onClick={go(home)} />

      {sections.map((section) => (
        <div key={section.heading}>
          <SidebarGroupLabel>{section.heading}</SidebarGroupLabel>
          {section.links.map(row)}
        </div>
      ))}

      <div>
        <SidebarGroupLabel>Station</SidebarGroupLabel>
        {/* No Notifications row: the header's bell shows at every width and carries the
            unread count. */}
        <SidebarNavRow href={`${home}/settings`} label="Settings" icon={settingsOutline} active={pathname === `${home}/settings`} onClick={go(`${home}/settings`)} />
        <SidebarNavRow
          label={signingOut ? 'Signing out…' : 'Sign out'}
          icon={logOutOutline}
          onClick={(e) => { e.preventDefault(); if (!signingOut) signOut() }}
        />
      </div>

      <SidebarUserFooter
        name={user?.name || user?.email || 'Account'}
        subtitle={user?.email && user?.name ? user.email : null}
        action={<ThemeControl cycle />}
      />
    </Sidebar>
  )

  return (
    <>
      {/* Desktop: a real column in normal flow, so the content beside it reflows on its own. */}
      <aside className="hidden lg:flex flex-col sticky top-0 self-start h-screen w-64 shrink-0 overflow-y-auto border-r-2 border-line bg-surface">
        {body}
      </aside>

      {/* Below lg: an overlay drawer, kept mounted so it slides rather than appears. It opens
          from the RIGHT, meeting the menu button, because the left of the header is the back
          arrow's. The two never co-exist (lg:hidden vs hidden lg:flex). */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      )}
      <aside
        className={`lg:hidden fixed top-0 right-0 z-50 h-full w-80 max-w-[85vw] overflow-y-auto border-l-2 border-line bg-surface transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
        {...(!open && { inert: '' })}
      >
        <div className="relative">
          {body}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="house-theme-cycle absolute right-2 top-2"
          >
            <IonIcon icon={closeOutline} aria-hidden="true" />
          </button>
        </div>
      </aside>
    </>
  )
}
