'use client'

import { IonFab, IonFabButton, IonIcon, useIonRouter } from '@ionic/react'

/**
 * The floating action button: the one thing a screen is for making (a new entry, a new chat),
 * pinned to the bottom right of the screen and clear of the phone's home bar. Ionic's IonFab in
 * the screen's fixed slot, so it must be a child of IonContent.
 *
 *   icon    an ionicons/icons value
 *   label   what a screen reader says: there are no words on it
 *   href    a path pushes that screen
 */
export default function Fab({ icon, label, onClick, href = null }) {
  const router = useIonRouter()
  return (
    <IonFab slot="fixed" vertical="bottom" horizontal="end" className="house-fab">
      <IonFabButton
        aria-label={label}
        onClick={(e) => {
          onClick?.(e)
          if (e.defaultPrevented) return
          if (href) router.push(href)
        }}
      >
        <IonIcon icon={icon} aria-hidden="true" />
      </IonFabButton>
    </IonFab>
  )
}
