'use client'

import { useEffect } from 'react'
import { Navigate, Route, useLocation } from 'react-router-dom'
import { IonApp, IonMenu, IonRouterOutlet, IonSplitPane, IonContent } from '@ionic/react'
import { IonReactRouter } from '@ionic/react-router'
import { AreaContext } from '@/lib/nav'
import { DASHBOARD_SCREENS } from '@/screens/routes'
import SavePushProvider from '@/components/SavePushProvider'
import StationSidebar from '@/components/StationSidebar'
import Screen from '@/components/shell/Screen'
import BackgroundSync, { stationIdFrom } from '@/components/shell/BackgroundSync'
import slideTransition from '@/components/shell/slideTransition'
import LicenceGate from '@/components/desktop/LicenceGate'
import AutoSync from '@/components/desktop/AutoSync'

/**
 * Desktop build: the station as one Ionic app: IonApp, Ionic's router, a split pane with the
 * sidebar as an IonMenu (a column on a wide window) and the screens in an IonRouterOutlet,
 * where each opens over the last as a stack.
 *
 * Mounted by app/dashboard/[[...path]], exported as one page that Electron answers every
 * /dashboard address with (electron/resolve.js). components/AppShell.js has already made sure
 * someone is signed in with their web account; LicenceGate makes sure the computer is linked and the
 * station's subscription runs.
 */

/** Wide enough for the sidebar to stay open beside the screen (Tailwind's lg). */
const SPLIT_WHEN = '(min-width: 1024px)'

function Menu() {
  const { pathname, search } = useLocation()
  const stationId = stationIdFrom(pathname, search)
  return (
    <IonMenu contentId="main" menuId="main" type="overlay" disabled={!stationId}>
      <IonContent>
        {stationId ? <StationSidebar stationId={stationId} /> : null}
      </IonContent>
    </IonMenu>
  )
}

export default function IonicShell({ area }) {
  // Desktop build: the station's screens only, no admin area.
  const screens = DASHBOARD_SCREENS

  // The app scrolls inside its screens, never the document (globals.css, html.ionic-app).
  useEffect(() => {
    document.documentElement.classList.add('ionic-app')
    return () => document.documentElement.classList.remove('ionic-app')
  }, [])

  return (
    <AreaContext.Provider value={area}>
      <IonApp>
        <IonReactRouter>
          {/* Desktop build: nothing opens until this computer is linked and the station's
              subscription runs (components/desktop/LicenceGate.js). */}
          <LicenceGate>
          <BackgroundSync />
          <AutoSync />
          <SavePushProvider>
            <IonSplitPane contentId="main" when={SPLIT_WHEN}>
              <Menu />
              {/* Screens slide in from the right when opened and out to the right on Back. */}
              <IonRouterOutlet id="main" animation={slideTransition}>
                {screens.map((screen) => (
                  <Route key={screen.path} path={screen.path} element={<Screen screen={screen} />} />
                ))}
                <Route path="*" element={<Navigate to={area} replace />} />
              </IonRouterOutlet>
            </IonSplitPane>
          </SavePushProvider>
          </LicenceGate>
        </IonReactRouter>
      </IonApp>
    </AreaContext.Provider>
  )
}
