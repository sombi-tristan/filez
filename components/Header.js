'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { homeOutline, menuOutline, notificationsOutline } from 'ionicons/icons'
import { AppHeader, Badge, IconButton, Spinner } from '@/design'
import useStationUnread from '@/lib/useStationUnread'

// Map paths to page titles. Back always uses router.back().
const PAGE_TITLES = {
  // Dashboard
  '/dashboard': 'Dashboard',
  '/dashboard/subscribe': 'Subscribe',
  '/dashboard/feedback': 'Help & feedback',

  // Entries
  '/dashboard/entries': 'Entries',
  '/dashboard/entries/daily-sales': 'Daily Sales',
  '/dashboard/entries/daily-sales/list': 'Daily Sales Entries',
  '/dashboard/entries/product-receipt': 'Product Receipt',
  '/dashboard/entries/product-receipt/list': 'Receipt Entries',
  '/dashboard/entries/lodgements': 'Lodgements',
  '/dashboard/entries/lodgements/list': 'Lodgement Entries',
  '/dashboard/entries/lube': 'Lube',
  '/dashboard/entries/lube/list': 'Lube Entries',
  '/dashboard/entries/customer-payments': 'Account Payment',
  '/dashboard/entries/customer-payments/list': 'Account Entries',

  // Reports
  '/dashboard/reports/summary': 'Summary',
  '/dashboard/reports/daily-sales-report': 'Daily Sales Report',
  '/dashboard/reports/sales-overview': 'Sales Overview',
  '/dashboard/reports/inventory-log': 'Inventory Log',
  '/dashboard/reports/analytics': 'Analytics',
  '/dashboard/reports/audit-report': 'Audit Report',
  '/dashboard/reports/account-ledger': 'Account Ledger',
  '/dashboard/reports/product-received': 'Product Received',
  '/dashboard/reports/dip-calculator': 'Dip Calculator',

  // Admin
  '/admin': 'Subscriptions',
  '/admin/services': 'Services',
  '/admin/users': 'Staff',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'Stations',
  '/admin/excel-templates': 'Excel Templates',
}

function getTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]

  const settingsMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/settings$/)
  if (settingsMatch) return 'Settings'

  const notifMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)\/notifications$/)
  if (notifMatch) return 'Notifications'

  const stationMatch = pathname.match(/^\/dashboard\/stations\/[^/]+$/)
  if (stationMatch) return 'Station'

  const setupMatch = pathname.match(/^\/dashboard\/setup\/[^/]+$/)
  if (setupMatch) return 'Setup'

  const payMatch = pathname.match(/^\/dashboard\/subscribe\/pay\//)
  if (payMatch) return 'Payment'

  return null
}

export default function Header({ onMenu }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [navigating, setNavigating] = useState(false)

  // Reset spinner when route changes
  useEffect(() => { setNavigating(false) }, [pathname])

  // Derived above the auth early-return: useStationUnread is a hook, so it cannot sit after
  // a conditional return. It no-ops on a null station.
  const stationMatch = pathname.match(/^\/dashboard\/stations\/([^/]+)/)
  const stationId = stationMatch ? stationMatch[1] : searchParams.get('org_id')
  const { unread } = useStationUnread(stationId)

  const isAuth = pathname.startsWith('/auth')
  if (isAuth) return null

  const title = getTitle(pathname)
  const isDashboardHome = pathname === '/dashboard'

  const homeHref = stationId ? `/dashboard/stations/${stationId}` : '/dashboard'
  const isAlreadyHome = pathname === homeHref

  const handleHomeClick = () => {
    if (isAlreadyHome || navigating) return
    setNavigating(true)
    router.push(homeHref)
  }

  // The house top bar. It sits in the document flow, so it is pinned here rather than by an
  // IonPage. Navigation is Next's router: the house parts would use Ionic's, which this app
  // does not run, so every action is handed its own onClick or onBack.
  return (
    <div className="sticky top-0 z-30">
      <AppHeader
        title={title || 'Dashboard'}
        onBack={isDashboardHome ? null : () => router.back()}
        actions={
          <>
            {/* Shown at every width: the sidebar has no Notifications row, so this bell and
                its unread count are the one way in. */}
            {stationId && (
              <span className="relative inline-flex">
                <IconButton
                  icon={notificationsOutline}
                  label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
                  variant="neutral"
                  onClick={() => router.push(`/dashboard/stations/${stationId}/notifications`)}
                />
                <Badge count={unread} className="absolute -top-1 -right-1 pointer-events-none" />
              </span>
            )}
            {navigating ? (
              <span className="inline-flex w-12 justify-center"><Spinner /></span>
            ) : (
              <IconButton icon={homeOutline} label="Home" variant="neutral" onClick={handleHomeClick} />
            )}
            {/* Below lg only: at lg and up the sidebar is a permanent column. At this end of
                the bar because the drawer opens from the right and the left is the back
                arrow's. */}
            {onMenu && (
              <span className="lg:hidden inline-flex">
                <IconButton icon={menuOutline} label="Open menu" variant="neutral" onClick={onMenu} />
              </span>
            )}
          </>
        }
      />
    </div>
  )
}
