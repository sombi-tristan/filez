'use client'

import { useEffect, useState } from 'react'
import { IonToast } from '@ionic/react'
import { close, refreshOutline } from 'ionicons/icons'
import { TOAST_SLIDE } from '@/design'

// Surfaces a "new version" toast when the service worker updates. AppShell already
// calls reg.update() + activates a waiting worker (SKIP_WAITING), so a new worker
// takes control and fires `controllerchange`. We only toast when a controller was
// already in place (a real update, not the first install), letting the user reload
// to pick up the new code instead of being stuck on the cached bundle.
//
// Dressed as the house Toast (design/components/Toast.jsx, tone "info"), drawn from IonToast
// directly because this one needs a Refresh button and stays until it is answered.
export default function PWAUpdateToast() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const hadController = !!navigator.serviceWorker.controller
    const onChange = () => { if (hadController) setShow(true) }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])

  return (
    <IonToast
      isOpen={show}
      message="A new version is available."
      position="bottom"
      icon={refreshOutline}
      enterAnimation={TOAST_SLIDE.enter}
      leaveAnimation={TOAST_SLIDE.leave}
      cssClass="house-toast house-toast-info"
      buttons={[
        { text: 'Refresh', handler: () => window.location.reload() },
        { icon: close, role: 'cancel', htmlAttributes: { 'aria-label': 'Dismiss' } },
      ]}
      onDidDismiss={() => setShow(false)}
    />
  )
}
