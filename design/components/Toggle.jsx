'use client'

import { IonLoading, IonSpinner, IonToggle } from '@ionic/react'

/**
 * A switch with its words beside it, for a setting that is not a row in a list (in a list,
 * ListRow's `toggle`). `onChange` is called with the new state.
 */
export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <IonToggle checked={Boolean(checked)} disabled={disabled} labelPlacement="end" onIonChange={(e) => onChange(e.detail.checked)} className="house-toggle">
      {label}
    </IonToggle>
  )
}

/**
 * The spinner, in the accent, for the wait that has no shape to draw (a button's own action).
 * A screen that is loading draws a Skeleton instead. `size` in pixels.
 */
export function Spinner({ size = 24, label = 'Loading' }) {
  return <IonSpinner name="crescent" color="primary" aria-label={label} style={{ width: size, height: size }} />
}

/**
 * The whole screen held while something that must finish does (a save that other things wait
 * on): a scrim, a spinner and one word. Nothing behind it can be tapped.
 */
export function LoadingOverlay({ open, label = 'Loading' }) {
  return <IonLoading isOpen={open} message={label} spinner="crescent" />
}
