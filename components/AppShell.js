'use client'

// Must stay the first import: it answers /api/* inside the app, and every screen below fetches.
import '@/lib/local/installFetch'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Header from './Header'
import StationSidebar from './StationSidebar'
import Footer from './Footer'
import NavigationLoader from './NavigationLoader'
import { getSessionUserId } from '@/lib/local/session'

export default function AppShell({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  // Desktop build: every screen except sign-in needs a signed-in person on this computer.
  useEffect(() => {
    const isAuthPage = pathname.startsWith('/auth') || pathname === '/'
    if (!getSessionUserId() && !isAuthPage) {
      router.replace('/auth/login')
      return
    }
    setReady(true)
  }, [pathname, router])

  const isAuth = pathname.startsWith('/auth')
  const isHome = pathname === '/'
  /**
   * Reports opt out of the footer. Each one is a full-height workspace sized to
   * h-[calc(100dvh-3.5rem)], viewport minus the header, with its own bottom-pinned day tabs
   * and sticky control bar. A footer underneath adds height past the viewport, so the page
   * gains a scrollbar and those pinned controls fall below the fold.
   */
  const isReport = pathname.startsWith('/dashboard/reports')

  // Auth pages + homepage: no shell, just content
  if (isAuth || isHome) return <>{children}</>
  if (!ready) return null

  // Station pages: sidebar column + content column. The sidebar is `shrink-0` and lives in
  // normal flow, so this has to be a row, and the content column needs min-w-0 or a wide
  // report table pushes the sidebar off screen instead of scrolling inside its own column.
  // StationSidebar reads useSearchParams, so it gets the same Suspense boundary as Header.
  return (
    <div className="flex min-h-screen">
      <Suspense fallback={null}>
        <StationSidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </Suspense>
      <div className="flex flex-col flex-1 min-w-0">
        <Suspense fallback={null}><NavigationLoader /></Suspense>
        <Suspense fallback={null}><Header onMenu={() => setDrawerOpen(true)} /></Suspense>
        <main className="flex-1">{children}</main>
        {!isReport && <Footer app />}
      </div>
    </div>
  )
}
