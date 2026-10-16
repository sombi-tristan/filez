'use client'

import { useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  barChartOutline, clipboardOutline, cubeOutline, documentOutline, logOutOutline, peopleOutline,
  settingsOutline,
} from 'ionicons/icons'
import {
  Sidebar, SidebarBrand, SidebarSwitcher, SidebarGroupLabel, SidebarNavRow, SidebarUserFooter,
  Tabs, ThemeControl,
} from '@/design'
import { supabase } from '@/lib/supabaseClient'

/**
 * The admin area's section switcher, built from the house sidebar parts so it and
 * StationSidebar read as one app.
 *
 * Two shapes:
 *   sm and up → the column: brand, who you are, the menu, and the way out
 *   below sm  → the house underline tabs along the top
 *
 * The tabs stay because the admin header carries no menu button, so there is nothing to open
 * a drawer with.
 *
 * No switcher options: admin is not scoped to a station, so there is nowhere to switch to.
 * The identity block still renders, without an affordance, so this column and the station one
 * line up.
 */

const LINKS = [
  { href: '/admin', label: 'Subscriptions', icon: clipboardOutline },
  { href: '/admin/services', label: 'Services', icon: cubeOutline },
  { href: '/admin/users', label: 'Staff', icon: peopleOutline },
  { href: '/admin/analytics', label: 'Analytics', icon: barChartOutline },
  { href: '/admin/excel-templates', label: 'Excel Templates', icon: documentOutline },
  { href: '/admin/settings', label: 'Settings', icon: settingsOutline },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // The house row would navigate with Ionic's router, which this app does not run.
  const go = (href) => (e) => {
    e.preventDefault()
    router.push(href)
  }

  const brandMark = (
    <Image src="/icon-192.png" alt="" aria-hidden width={32} height={32} className="w-8 h-8 shrink-0 rounded-house" />
  )

  return (
    <>
      {/* Below sm: the same destinations as underline tabs. */}
      <div className="sm:hidden border-b-2 border-line bg-surface">
        <Tabs
          label="Admin"
          items={LINKS.map((l) => ({ id: l.href, label: l.label, icon: l.icon }))}
          value={pathname}
          onChange={(href) => router.push(href)}
        />
      </div>

      {/* sm and up: the column. Sticky under the app header (56px), and as tall as what is
          left of the screen. */}
      <aside className="hidden sm:flex flex-col sticky top-14 self-start h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r-2 border-line bg-surface">
        <Sidebar label="Admin">
          <SidebarBrand mark={brandMark} name="StationMGR" />
          <SidebarSwitcher title="Platform" subtitle="Admin" />
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          {LINKS.map((l) => (
            <SidebarNavRow
              key={l.href}
              href={l.href}
              label={l.label}
              icon={l.icon}
              active={pathname === l.href}
              onClick={go(l.href)}
            />
          ))}
          <SidebarNavRow
            label={signingOut ? 'Signing out…' : 'Sign out'}
            icon={logOutOutline}
            onClick={(e) => { e.preventDefault(); if (!signingOut) signOut() }}
          />
          <SidebarUserFooter name="Admin" action={<ThemeControl cycle />} />
        </Sidebar>
      </aside>
    </>
  )
}
