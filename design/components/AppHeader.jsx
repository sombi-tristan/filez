'use client'

import { IonButton, IonButtons, IonHeader, IonIcon, IonTitle, IonToolbar, useIonRouter } from '@ionic/react'
import { arrowBackOutline } from 'ionicons/icons'

/**
 * A screen's top bar: Ionic's header and toolbar, flat, with a 2px line under it.
 *
 *   title     the screen's name. With `onBack` or `backHref` a back arrow stands before it.
 *   brand     drawn in place of the title on a home screen (a logo and a name)
 *   actions   what sits at the end: icon buttons, a ThemeControl with `cycle`
 *   onBack    called by the back arrow; without it the arrow goes back in the app's own history,
 *             or to `backHref` when there is nowhere to go back to (the screen was opened by its
 *             address)
 */
export default function AppHeader({ title, brand = null, actions = null, onBack = null, backHref = null }) {
  const router = useIonRouter()
  const back = onBack || backHref
  return (
    <IonHeader className="house-header">
      <IonToolbar>
        {back ? (
          <IonButtons slot="start">
            <IonButton
              aria-label="Back"
              onClick={() => {
                if (onBack) onBack()
                else if (router.canGoBack()) router.goBack()
                else router.push(backHref, 'back')
              }}
            >
              <IonIcon slot="icon-only" icon={arrowBackOutline} />
            </IonButton>
          </IonButtons>
        ) : null}
        {brand ? <div className="house-header-brand">{brand}</div> : <IonTitle>{title}</IonTitle>}
        {actions ? <IonButtons slot="end">{actions}</IonButtons> : null}
      </IonToolbar>
    </IonHeader>
  )
}
