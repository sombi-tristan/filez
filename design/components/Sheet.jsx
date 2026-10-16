'use client'

import { useRef } from 'react'
import { IonIcon, IonModal } from '@ionic/react'

/**
 * A panel that rises from the bottom of the screen, as tall as what is in it (three quarters of
 * the screen at most, then it scrolls). Ionic's IonModal: it closes on the backdrop, on Escape,
 * on the phone's back button and on a drag down. On a computer, or with `modal`, the same
 * content opens centred. Dressed by `.house-sheet` in design/house.css.
 *
 *   open, onClose   the caller owns whether it is open
 *   label           what a screen reader calls it
 */
const WIDE = '(min-width: 1024px)'

export function BottomSheet({ open, onClose, label, children, modal = false }) {
  const ref = useRef(null)
  const centred = modal || (typeof window !== 'undefined' && window.matchMedia?.(WIDE).matches)

  if (centred) {
    return (
      <IonModal ref={ref} isOpen={open} onDidDismiss={() => onClose?.()} aria-label={label} className="house-sheet house-sheet-centred">
        <div className="house-sheet-panel">{children}</div>
      </IonModal>
    )
  }
  return (
    <IonModal
      ref={ref}
      isOpen={open}
      onDidDismiss={() => onClose?.()}
      aria-label={label}
      className="house-sheet"
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      handle={false}
    >
      <div className="house-sheet-panel">
        <span aria-hidden="true" className="house-sheet-handle" />
        {children}
      </div>
    </IonModal>
  )
}

/** One action in a sheet: an icon and a word, the whole width. `icon` is an ionicons/icons value. */
export function SheetAction({ icon, label, onClick, tone }) {
  return (
    <button type="button" onClick={onClick} className={`house-sheet-action ${tone === 'danger' ? 'house-sheet-action-danger' : ''}`.trim()}>
      {icon ? <IonIcon icon={icon} aria-hidden="true" /> : null}
      {label}
    </button>
  )
}

/**
 * The picture at the head of a sheet or an empty screen: an icon on a round plate, and a title.
 * `icon` is an ionicons/icons value. A consumer app may pass `emoji` or `art` (a picture's
 * address) instead; a business app uses the icon.
 */
export function SheetHero({ icon = null, emoji = null, art = null, title = null }) {
  return (
    <div className="house-hero">
      <span className="house-hero-plate">
        {art ? (
          <img src={art} alt="" width={80} height={80} draggable="false" />
        ) : icon ? (
          <IonIcon icon={icon} aria-hidden="true" />
        ) : (
          <span aria-hidden="true" className="house-hero-emoji">
            {emoji}
          </span>
        )}
      </span>
      {title ? <p className="house-hero-title">{title}</p> : null}
    </div>
  )
}
