'use client'

import { Suspense, useContext, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar,
  useIonRouter,
} from '@ionic/react'
import { homeOutline } from 'ionicons/icons'
import { IconButton, Spinner } from '@/design'
import { AreaContext, ScreenLocationContext } from '@/lib/nav'
import { useLicence, ServiceLocked } from '@/components/desktop/LicenceGate'
import Footer from '@/components/Footer'

/**
 * One screen of the Ionic app: an IonPage with the house top bar and the screen's content in
 * an IonContent that scrolls on its own. Opened over another screen, it slides in on top; Back
 * slides it away and the one underneath is still there as it was left.
 *
 * The screen keeps the address it was opened at. React Router has one live location, and a
 * screen lower in the stack would otherwise read the top screen's ?org_id= and ?edit_date=.
 * It follows the live location only while that is still its own path (a filter or a day
 * changed in place with router.replace or a link to the same screen).
 *
 * Each visit is a fresh screen. Ionic keeps a screen that Back slid away and reuses it the next
 * time its path is opened, so a form would come back with what was typed before. The page is
 * keyed by the history entry it was opened for: a new visit (or a new day in place) remounts
 * it, while Back to a screen underneath returns to its own entry and keeps it as it was left.
 */
export default function Screen({ screen }) {
  const live = useLocation()
  const [held, setHeld] = useState(live)
  if (live.pathname === held.pathname && live.key !== held.key) {
    setHeld(live)
  }

  const area = useContext(AreaContext)
  const params = useParams()
  const ionRouter = useIonRouter()

  const stationId = params.stationId || new URLSearchParams(held.search).get('org_id') || ''
  // Desktop build: a screen whose service has run out shows what it needs instead.
  const licence = useLicence()
  const locked = Boolean(screen.service) && !licence?.active?.[screen.service]

  const home = stationId ? `/dashboard/stations/${stationId}` : area
  const atHome = held.pathname === home
  const { Page } = screen

  return (
    <ScreenLocationContext.Provider value={held}>
      <IonPage>
        <IonHeader className="house-header">
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton />
              {/* Desktop build: the station home is the root; /dashboard only leads back to it. */}
              {held.pathname !== area && !atHome && <IonBackButton defaultHref={home} text="" />}
            </IonButtons>
            <IonTitle>{screen.title || 'StationMGR'}</IonTitle>
            <IonButtons slot="end">
              {!atHome && (
                <span className="ml-2 inline-flex">
                  {/* Home goes back to the root of the stack rather than piling another
                      screen on top of it. */}
                  <IconButton icon={homeOutline} label="Home" variant="neutral" onClick={() => ionRouter.push(home, 'root', 'replace')} />
                </span>
              )}
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* At least the content's height, with the page taking the room, so the footer sits
              at the bottom of a short screen and under the last line of a long one. */}
          <div className="min-h-full flex flex-col">
            <div className="flex-1">
              {locked ? (
                <ServiceLocked service={screen.service} />
              ) : (
                <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
                  <Page key={held.key} />
                </Suspense>
              )}
            </div>
            {(!screen.report || locked) && <Footer />}
          </div>
        </IonContent>
      </IonPage>
    </ScreenLocationContext.Provider>
  )
}
