'use client'

import { useRef } from 'react'
import { IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/react'

/**
 * A row that slides left to show its buttons. Ionic's own sliding item, so the drag, the snap
 * and the one-open-at-a-time behaviour are the platform's.
 *
 *   actions  [{ key, label, tone, onClick }]; tone is 'danger', 'accent' or plain. A falsy
 *            entry is skipped, so a caller can write `canDelete && {...}`.
 *
 * With no actions the children are drawn as they are.
 */
const TONES = { danger: 'house-swipe-danger', accent: 'house-swipe-accent' }

export default function SwipeRow({ actions = [], children }) {
  const ref = useRef(null)
  const shown = actions.filter(Boolean)
  if (!shown.length) return children
  return (
    <IonItemSliding ref={ref} className="house-swipe">
      <IonItem lines="none" className="house-swipe-item">
        <div className="house-swipe-body">{children}</div>
      </IonItem>
      <IonItemOptions side="end">
        {shown.map((a) => (
          <IonItemOption
            key={a.key}
            className={`house-swipe-option ${TONES[a.tone] || ''}`.trim()}
            onClick={() => {
              ref.current?.close?.()
              a.onClick?.()
            }}
          >
            {a.label}
          </IonItemOption>
        ))}
      </IonItemOptions>
    </IonItemSliding>
  )
}
