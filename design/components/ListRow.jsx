'use client'

import { IonIcon, IonItem, IonLabel, IonToggle, useIonRouter } from '@ionic/react'
import { chevronForward } from 'ionicons/icons'

/**
 * A tappable row, like a phone's Settings list: the whole row is the target, the label on the
 * left, the current value (and a chevron) on the right. Dressed by `.house-row` in
 * design/house.css.
 *
 *   label    the words
 *   note     a quieter second line under the label
 *   value    what the setting is now, drawn at the end
 *   toggle   true or false draws a switch at the end in place of a value. The row is still the
 *            control (its onClick flips the setting); the switch only shows the state and takes
 *            no taps of its own, since two things answering one tap flip a switch twice.
 *   icon     an ionicons/icons value before the label; `start` is anything else drawn there
 *            (an avatar)
 *   href     a path pushes that screen
 *   tone     'danger' for Sign out and the like
 *   detail   false drops the chevron, for a row that acts in place rather than going somewhere
 */
export default function ListRow({
  label,
  note = null,
  value = null,
  toggle = null,
  start = null,
  icon = null,
  onClick,
  href = null,
  tone = 'default',
  detail = true,
  disabled = false,
}) {
  const router = useIonRouter()
  const acts = Boolean(onClick || href)
  return (
    <IonItem
      button={acts}
      detail={false}
      lines="none"
      disabled={disabled}
      className={`house-row ${tone === 'danger' ? 'house-row-danger' : ''}`.trim()}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (href) router.push(href)
      }}
    >
      {icon ? <IonIcon slot="start" icon={icon} className="house-row-icon" aria-hidden="true" /> : start ? <span slot="start">{start}</span> : null}
      <IonLabel>
        {label}
        {note ? <p>{note}</p> : null}
      </IonLabel>
      {toggle != null ? (
        <IonToggle slot="end" checked={Boolean(toggle)} aria-label={label} style={{ pointerEvents: 'none' }} />
      ) : value != null ? (
        <span slot="end" className="house-row-value">
          {value}
        </span>
      ) : null}
      {acts && detail && toggle == null ? <IonIcon slot="end" icon={chevronForward} className="house-row-chevron" aria-hidden="true" /> : null}
    </IonItem>
  )
}
