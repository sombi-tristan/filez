'use client'

import { useState } from 'react'
import Image from 'next/image'
import { menuController } from '@ionic/core/components'
import { usePathname, useRouter } from '@/lib/nav'
import {
  barChartOutline, clipboardOutline, cubeOutline, documentOutline, logOutOutline, peopleOutline,
  settingsOutline,
} from 'ionicons/icons'
import {
  Sidebar, SidebarBrand, SidebarSwitcher, SidebarSections, SidebarSection, SidebarNavRow, SidebarUserFooter,
  ThemeControl,
} from '@/design'
import { supabase } from '@/lib/supabaseClient'

/**
 * The admin area's section switcher, built from the house sidebar parts so it and
 * StationSidebar read as one app. It is the content of the admin area's IonMenu
 * (components/shell/IonicShell.js): a column on a computer, a drawer on a phone.
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
  // Every admin screen is in the Admin group, so it starts open.
  const [openGroup, setOpenGroup] = useState('admin')

  const signOut = async () => {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  // Opens the screen as a fresh stack and, on a phone, puts the drawer away.
  const go = (href) => (e) => {
    e.preventDefault()
    menuController.close('main')
    router.root(href)
  }

  const brandMark = (
    <Image src="/icon-192.png" alt="" aria-hidden width={32} height={32} className="w-8 h-8 shrink-0 rounded-house" />
  )

  return (
    <Sidebar label="Admin">
      <SidebarBrand mark={brandMark} name="StationMGR" />
      <SidebarSwitcher title="Platform" subtitle="Admin" />
      {/* The groups as accordions, one open at a time, as in the station sidebar. */}
      <SidebarSections value={openGroup} onChange={setOpenGroup}>
        <SidebarSection value="admin" label="Admin">
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
        </SidebarSection>
        <SidebarSection value="account" label="Account">
          <SidebarNavRow
            label={signingOut ? 'Signing out…' : 'Sign out'}
            icon={logOutOutline}
            onClick={(e) => { e.preventDefault(); if (!signingOut) signOut() }}
          />
        </SidebarSection>
      </SidebarSections>
      <SidebarUserFooter name="Admin" action={<ThemeControl cycle />} />
    </Sidebar>
  )
}
