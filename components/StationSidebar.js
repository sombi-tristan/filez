'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from '@/lib/nav'
import { IonIcon } from '@ionic/react'
import { menuController } from '@ionic/core/components'
import {
  bookOutline, cardOutline, cubeOutline, documentTextOutline, gridOutline,
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
 * It is the content of the dashboard's IonMenu (components/shell/IonicShell.js), inside an
 * IonSplitPane: a column beside the screen on a computer, a drawer on a phone. `stationId` is
 * the open station, read by the shell from the address.
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

export default function StationSidebar({ stationId }) {
  const pathname = usePathname()
  const router = useRouter()

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

  // Opens the screen and, on a phone, puts the drawer away. A destination from the menu
  // starts a fresh stack rather than piling onto whatever was open.
  const go = (href) => (e) => {
    e.preventDefault()
    menuController.close('main')
    router.root(href)
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

  return (
    <Sidebar label="Station">
      <SidebarBrand mark={brandMark} name="StationMGR" />
      <SidebarSwitcher
        title={current?.name || 'Station'}
        subtitle={isOwner ? 'Owner' : 'Staff member'}
        currentId={String(stationId)}
        options={stations.map((s) => ({ id: String(s.id), title: s.name }))}
        onPick={(o) => { if (String(o.id) !== String(stationId)) { menuController.close('main'); router.root(`/dashboard/stations/${o.id}`) } }}
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
}
