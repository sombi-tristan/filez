'use client'

import { useEffect } from 'react'
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

/**
 * The dashboard, or the admin area, as one Ionic app: IonApp, Ionic's router, a split pane
 * with the sidebar as an IonMenu (a column on a computer, a drawer on a phone) and the screens
 * in an IonRouterOutlet, where each opens over the last as a stack.
 *
 * Mounted by app/dashboard/[[...path]] and app/admin/[[...path]], in the browser only. Every
 * address under the area lands on that one Next.js page, and Ionic's router takes it from
 * there. Leaving the area is a full page load (lib/nav.js), so middleware.js still checks
 * sign-in and the admin role on the way into each area.
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
        </IonReactRouter>
      </IonApp>
    </AreaContext.Provider>
  )
}
