'use client'

import { useEffect, useState } from 'react'
import { IonIcon, IonModal } from '@ionic/react'
import { close } from 'ionicons/icons'
import Button from './Button.jsx'

/**
 * A dialog: a title, a close cross, and whatever is asked. Centred on the screen, or rising
 * from the bottom with `placement="bottom"`. Ionic's IonModal over a 70% scrim; it closes on
 * the scrim, the cross, Escape and the phone's back button. Dressed by `.house-dialog`.
 *
 * Without `onClose` it cannot be dismissed, which is how a dialog waits out a request.
 */
export function Dialog({ open, onClose, title, children, placement = 'center' }) {
  const bottom = placement === 'bottom'
  return (
    <IonModal
      isOpen={open}
      onDidDismiss={() => onClose?.()}
      backdropDismiss={Boolean(onClose)}
      canDismiss={Boolean(onClose) || !open}
      className={`house-dialog ${bottom ? 'house-dialog-bottom' : ''}`.trim()}
      {...(bottom ? { initialBreakpoint: 1, breakpoints: [0, 1], handle: false } : {})}
    >
      <div className="house-dialog-panel" role="document">
        <div className="house-dialog-head">
          <h3>{title}</h3>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close">
              <IonIcon icon={close} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="house-dialog-body">{children}</div>
      </div>
    </IonModal>
  )
}

/**
 * "Are you sure?", before something that cannot be taken back. Cancel beside the answer; while
 * the answer is being carried out both are held and it cannot be closed. `onConfirm` may be
 * async: if it throws, or resolves to `{ error }`, the dialog stays open and says why.
 *
 *   variant  'danger' (the default) or 'primary', for the confirming button
 */
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Are you sure?', children, confirmLabel = 'Confirm', variant = 'danger' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setBusy(false)
      setError('')
    }
  }, [open])

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await onConfirm()
      if (result?.error) {
        setError(result.error)
        setBusy(false)
        return
      }
      onClose?.()
    } catch (e) {
      setError(e?.message || 'That did not work. Try again.')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} title={title} placement="bottom">
      {children ? <p className="house-dialog-line">{children}</p> : null}
      {error ? <p className="house-dialog-error">{error}</p> : null}
      <div className="house-dialog-answers">
        <Button variant="neutral" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant={variant} onClick={confirm} disabled={busy}>
          {busy ? 'Working...' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
