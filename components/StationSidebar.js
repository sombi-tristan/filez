'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import RestoreBackup from '@/components/RestoreBackup'
import { usePathname, useRouter } from '@/lib/nav'
import { menuController } from '@ionic/core/components'
import {
  bookOutline, cardOutline, cubeOutline, documentTextOutline, gridOutline,
  homeOutline, logOutOutline, pulseOutline, receiptOutline, settingsOutline, statsChartOutline,
  trendingUpOutline, carOutline, walletOutline, waterOutline, peopleOutline, clipboardOutline,
  analyticsOutline, flameOutline,
} from 'ionicons/icons'
import {
  Sidebar, SidebarBrand, SidebarSwitcher, SidebarSections, SidebarSection, SidebarNavRow, SidebarUserFooter,
  ThemeControl,
} from '@/design'
import { supabase } from '@/lib/supabaseClient'
import { buildStationNav } from '@/lib/stationNav'
import { db } from '@/lib/db'

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
 * offer different destinations. A destination this member may not open is left out, as on the
 * station home, and a group left empty goes with it.
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
  'report-audit-consumption': flameOutline,
  'report-analytics': analyticsOutline,
  'report-audit': receiptOutline,
  'report-account-ledger': bookOutline,
  'report-product-received': carOutline,
  'report-lube': waterOutline,
  imprest: walletOutline,
}

/** The heading of the station's own group (Settings, Sign out). */
const STATION_GROUP = 'Station'

/**
 * The group holding the screen at `pathname`: the entry or report group whose link it is, or
 * the station's own group for its settings. Null for a screen in no group (the station home).
 */
function groupFor(pathname, stationId) {
  if (!stationId) return null
  if (pathname === `/dashboard/stations/${stationId}/settings`) return STATION_GROUP
  const sections = buildStationNav(stationId, { isOwner: true })
  // An entry link opens its list (…/daily-sales/list); the form beside it (…/daily-sales) is in
  // the same group.
  const base = (href) => href.split('?')[0].replace(/\/list$/, '')
  const hit = sections.find((section) => section.links.some((l) => pathname === base(l.href) || pathname.startsWith(`${base(l.href)}/`)))
  return hit ? hit.heading : null
}

export default function StationSidebar({ stationId }) {
  const pathname = usePathname()
  const router = useRouter()

  const [isOwner, setIsOwner] = useState(false)
  const restoreRef = useRef(null)
  const [visiblePages, setVisiblePages] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [user, setUser] = useState(null)
  const [stations, setStations] = useState([])
  // The group whose accordion is open. It follows the screen: opening a screen opens the group
  // that holds it, and a tap on another group's heading opens that one instead.
  const [openGroup, setOpenGroup] = useState('')
  const groupOfScreen = groupFor(pathname, stationId)
  useEffect(() => {
    if (groupOfScreen) setOpenGroup(groupOfScreen)
  }, [groupOfScreen])

  useEffect(() => {
    if (!stationId) return
    let alive = true
    // No answer (offline): the station's permissions saved by any screen opened online
    // (lib/hooks/usePageAccess.js), so an owner keeps the whole menu. Nothing saved: unrestricted,
    // and each screen still checks for itself (components/AccessGate.js).
    const loadSaved = async () => {
      const saved = await db.accessCache.filter((c) => c.key.startsWith(`${stationId}:`)).first().catch(() => null)
      if (!alive || !saved) return
      setIsOwner(saved.isOwner)
      setVisiblePages(saved.isOwner ? null : saved.visiblePages || [])
    }
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
        if (!alive) return
        if (perm?.visiblePages) setVisiblePages(perm.visiblePages)
        else await loadSaved()
      } catch {
        await loadSaved()
      }
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

  const row = (link) => (
    <SidebarNavRow
      key={link.href}
      href={link.href}
      label={link.label}
      icon={ICONS[link.pageKey] || documentTextOutline}
      active={isCurrent(link.href)}
      badge={link.badge}
      onClick={go(link.href)}
    />
  )

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
        // The owner's last row: a StationMGR Desktop backup file into this station.
        action={isOwner ? { label: 'Restore from backup', onPick: () => { restoreRef.current?.pick(); menuController.close('main') } } : null}
      />
      {isOwner && <RestoreBackup ref={restoreRef} stationId={stationId} />}

      <SidebarNavRow href={home} label="Station home" icon={homeOutline} active={pathname === home} onClick={go(home)} />

      {/* Each group is an accordion, one open at a time. */}
      <SidebarSections value={openGroup} onChange={setOpenGroup}>
        {sections.map((section) => ({ ...section, links: section.links.filter((l) => l.allowed) })).filter((s) => s.links.length).map((section) => (
          <SidebarSection key={section.heading} value={section.heading} label={section.heading}>
            {section.links.map(row)}
          </SidebarSection>
        ))}

        <SidebarSection value={STATION_GROUP} label="Station">
          {/* No Notifications row: who did what is shown under each entry instead. */}
          {/* Settings: the owner's (or a platform admin's helping out), not staff's. */}
          {(isOwner || user?.role === 'admin') && (
            <SidebarNavRow href={`${home}/settings`} label="Settings" icon={settingsOutline} active={pathname === `${home}/settings`} onClick={go(`${home}/settings`)} />
          )}
          <SidebarNavRow
            label={signingOut ? 'Signing out…' : 'Sign out'}
            icon={logOutOutline}
            onClick={(e) => { e.preventDefault(); if (!signingOut) signOut() }}
          />
        </SidebarSection>
      </SidebarSections>

      <SidebarUserFooter
        name={user?.name || user?.email || 'Account'}
        subtitle={user?.email && user?.name ? user.email : null}
        action={<ThemeControl cycle />}
      />
    </Sidebar>
  )
}
