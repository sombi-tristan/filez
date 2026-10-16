'use client'

import { useEffect, useState } from 'react'
import { IonToast } from '@ionic/react'
import { alertCircle, checkmarkCircle, close, notifications } from 'ionicons/icons'
import { TOAST_SLIDE } from './toastSlide'

/**
 * The notice: one neutral Ionic toast, an icon telling the type. Dressed by `.house-toast` in
 * design/house.css.
 *
 * A toast rather than a line of text under the button: it does not move the page, it cannot be
 * off screen, and it takes itself away.
 *
 * The caller clears its message in `onDone`, so the same message shows again on a second
 * failure (the same wrong password twice).
 *
 * `tone` picks only the icon: 'error' (the default), 'success' for a confirmation, 'info'.
 */
const ICONS = { error: alertCircle, success: checkmarkCircle, info: notifications }

export default function Toast({ children, tone = 'error', onDone }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (children) setShown(true)
  }, [children])

  return (
    <IonToast
      isOpen={Boolean(children) && shown}
      message={typeof children === 'string' ? children : String(children ?? '')}
      duration={5000}
      position="bottom"
      swipeGesture="vertical"
      enterAnimation={TOAST_SLIDE.enter}
      leaveAnimation={TOAST_SLIDE.leave}
      icon={ICONS[tone] || ICONS.error}
      cssClass={`house-toast house-toast-${tone}`}
      buttons={[{ icon: close, role: 'cancel', htmlAttributes: { 'aria-label': 'Close' } }]}
      onDidDismiss={() => {
        setShown(false)
        onDone?.()
      }}
    />
  )
}
