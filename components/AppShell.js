'use client'

// Must stay the first import: it answers /api/* inside the app, and every screen below fetches.
import '@/lib/local/installFetch'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { getSessionUserId } from '@/lib/local/session'

/**
 * Desktop build. The station's screens draw their own top bar, menu and pages as an Ionic app
 * (components/shell/IonicShell.js); this only makes sure someone is signed in on this computer
 * first. Sign-in and the start page are plain pages.
 */
export default function AppShell({ children }) {
  const pathname = usePathname()
  const isOpen = pathname === '/' || pathname.startsWith('/auth')
  const [ready, setReady] = useState(isOpen)

  useEffect(() => {
    if (isOpen) { setReady(true); return }
    // A full load, not a client navigation: sign-in is a plain page outside the Ionic app.
    if (!getSessionUserId()) { window.location.replace('/auth/login'); return }
    setReady(true)
  }, [isOpen])

  return ready ? <>{children}</> : null
}
