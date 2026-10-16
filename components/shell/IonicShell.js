'use client'

import { useEffect, useState } from 'react'
import { Navigate, Route, useLocation } from 'react-router-dom'
import { IonApp, IonMenu, IonRouterOutlet, IonSplitPane, IonContent } from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { AreaContext } from '@/lib/nav'
import { DASHBOARD_SCREENS, ADMIN_SCREENS } from '@/screens/routes'
import SavePushProvider from '@/components/SavePushProvider'
import StationSidebar from '@/components/StationSidebar'
import AdminSidebar from '@/components/AdminSidebar'
import Screen from '@/components/shell/Screen'
import BackgroundSync, { stationIdFrom } from '@/components/shell/BackgroundSync'
import slideTransition from '@/components/shell/slideTransition'
import DesktopDownload from '@/components/DesktopDownload'
import { COMPUTER_PATHS, useIsComputer } from '@/lib/platform'

/**
 * The dashboard, or the admin area, as one Ionic app: IonApp, Ionic's router, a split pane
 * with the sidebar as an IonMenu (a column on a computer, a drawer on a phone) and the screens
 * in an IonRouterOutlet, where each opens over the last as a stack.
 *
 * Mounted by app/dashboard/[[...path]] and app/admin/[[...path]], in the browser only. Every
 * address under the area lands on that one Next.js page, and Ionic's router takes it from
 * there. Leaving the area is a full page load (lib/nav.js), so middleware.js still checks
 * sign-in and the admin role on the way into each area.
 *
 * On a computer the dashboard is the desktop app's (lib/platform.js): this shows the download
 * page instead, except on the subscription screens and for platform admins.
 */

/** Wide enough for the sidebar to stay open beside the screen (Tailwind's lg). */
const SPLIT_WHEN = '(min-width: 1024px)'

function Menu({ area }) {
  const { pathname, search } = useLocation()
  const stationId = area === '/dashboard' ? stationIdFrom(pathname, search) : ''
  // The dashboard's menu is the station's: on the station picker there is none to show.
  const disabled = area === '/dashboard' && !stationId
  return (
    <IonMenu contentId="main" menuId="main" type="overlay" disabled={disabled}>
      <IonContent>
        {area === '/admin' ? <AdminSidebar /> : stationId ? <StationSidebar stationId={stationId} /> : null}
      </IonContent>
    </IonMenu>
  )
}

function Gate({ area, children }) {
  return area === '/dashboard' ? <ComputerGate>{children}</ComputerGate> : children
}

const ROLE_KEY = 'stationmgr.role'

/** Whether the signed-in person is a platform admin: remembered, so the answer is instant. */
function useIsAdmin() {
  const [admin, setAdmin] = useState(() => {
    try { return localStorage.getItem(ROLE_KEY) === 'admin' } catch { return false }
  })
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.user?.role || ''
        try { localStorage.setItem(ROLE_KEY, role) } catch { /* unavailable */ }
        setAdmin(role === 'admin')
      })
      .catch(() => {})
  }, [])
  return admin
}

/** The dashboard on a computer: the download page, unless the screen is one a computer keeps. */
function ComputerGate({ children }) {
  const { pathname } = useLocation()
  const computer = useIsComputer()
  const admin = useIsAdmin()
  const kept = COMPUTER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (computer && !kept && !admin) return <DesktopDownload signedIn />
  return children
}

export default function IonicShell({ area }) {
  const screens = area === '/admin' ? ADMIN_SCREENS : DASHBOARD_SCREENS

  // The app scrolls inside its screens, never the document (globals.css, html.ionic-app).
  useEffect(() => {
    document.documentElement.classList.add('ionic-app')
    return () => document.documentElement.classList.remove('ionic-app')
  }, [])

  return (
    <AreaContext.Provider value={area}>
      <IonApp>
        <IonReactRouter>
          <Gate area={area}>
            {area === '/dashboard' && <BackgroundSync />}
            <SavePushProvider>
              <IonSplitPane contentId="main" when={SPLIT_WHEN}>
                <Menu area={area} />
                {/* Screens slide in from the right when opened and out to the right on Back. */}
                <IonRouterOutlet id="main" animation={slideTransition}>
                  {screens.map((screen) => (
                    <Route key={screen.path} path={screen.path} element={<Screen screen={screen} />} />
                  ))}
                  <Route path="*" element={<Navigate to={area} replace />} />
                </IonRouterOutlet>
              </IonSplitPane>
            </SavePushProvider>
          </Gate>
        </IonReactRouter>
      </IonApp>
    </AreaContext.Provider>
  )
}
