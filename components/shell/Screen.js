'use client'

import { Suspense, useContext, useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonMenuButton, IonPage, IonTitle, IonToolbar,
  useIonRouter,
} from '@ionic/react'
import { desktopOutline, homeOutline } from 'ionicons/icons'
import { EmptyState, IconButton } from '@/design'
import { AreaContext, ScreenLocationContext } from '@/lib/nav'
import AdminViewingBanner from '@/components/AdminViewingBanner'
import Footer from '@/components/Footer'
import { recordReportPath } from '@/lib/recentReports'
import AccessGate from '@/components/AccessGate'
import { ReportSkeleton, ListSkeleton, FormSkeleton, PageSkeleton } from '@/components/Skeletons'

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
/** A report the web does not keep (screens/routes.js `desktopOnly`). */
function DesktopOnly() {
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <EmptyState icon={desktopOutline} title="In the desktop app">
        This report is in StationMGR for Windows. On the phone: Summary,
        Consumption &amp; Fuel Stock, Account Ledger and Lube Report.
      </EmptyState>
    </div>
  )
}

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

  // A report notes itself on each visit, for the station home's recently opened reports.
  useEffect(() => {
    if (screen.report && stationId) recordReportPath(stationId, screen.path)
  }, [held.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const home = stationId ? `/dashboard/stations/${stationId}` : area
  const atHome = held.pathname === home
  const { Page } = screen

  return (
    <ScreenLocationContext.Provider value={held}>
      <IonPage>
        <IonHeader className="house-header">
          <IonToolbar>
            {/* Home (the station home, or the area's own page) has the menu and no back arrow;
                every other screen has the back arrow and no menu. */}
            <IonButtons slot="start">
              {atHome ? <IonMenuButton /> : <IonBackButton defaultHref={home} text="" />}
            </IonButtons>
            <IonTitle>{screen.title || 'StationMGR'}</IonTitle>
            <IonButtons slot="end">
              {/* No bell here any more: who did what is shown under each entry instead. */}
              {!atHome && (
                <span className="inline-flex">
                  {/* Home goes back to the root of the stack rather than piling another
                      screen on top of it. */}
                  <IconButton icon={homeOutline} label="Home" variant="neutral" onClick={() => ionRouter.push(home, 'root', 'replace')} />
                </span>
              )}
            </IonButtons>
          </IonToolbar>
          {area === '/dashboard' && <AdminViewingBanner />}
        </IonHeader>

        <IonContent>
          {/* At least the content's height, with the page taking the room, so the footer sits
              at the bottom of a short screen and under the last line of a long one. */}
          <div className="min-h-full flex flex-col">
            <div className="flex-1">
              {/* Entries and reports: every word bold, labels blue, bold figures orange
                  (app/globals.css .screen-ink), as in the desktop build. */}
              <div className={screen.report || screen.path.startsWith('/dashboard/entries') ? 'screen-ink' : undefined}>
                <Suspense fallback={screen.report ? <ReportSkeleton /> : screen.path.endsWith('/list') ? <ListSkeleton /> : screen.path.startsWith('/dashboard/entries/') ? <FormSkeleton /> : <PageSkeleton />}>
                  {screen.desktopOnly ? <DesktopOnly /> : screen.pageKey ? (
                    // An entry: only for the owner, or staff the owner gave this page.
                    <AccessGate orgId={stationId} pageKey={screen.pageKey} skeleton={screen.path.endsWith('/list') ? <ListSkeleton /> : undefined}><Page key={held.key} /></AccessGate>
                  ) : <Page key={held.key} />}
                </Suspense>
              </div>
            </div>
            {(!screen.report || screen.desktopOnly) && <Footer app />}
          </div>
        </IonContent>
      </IonPage>
    </ScreenLocationContext.Provider>
  )
}
