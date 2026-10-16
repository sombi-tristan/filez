'use client'

import { IonIcon, IonLabel, IonSegment, IonSegmentButton } from '@ionic/react'

/**
 * Underline tabs: Ionic's IonSegment, drawn as a bold label with an accent bar under it and the
 * others muted. Each tab is as wide as its words; a long row scrolls sideways. Dressed by
 * `.house-tabs` in design/house.css.
 *
 *   items     [{ id, label, icon }]; `icon` is an ionicons/icons value
 *   value     the chosen id
 *   onChange  called with the id that was tapped
 *   label     what a screen reader calls the row
 *
 * A tap on the button, not the segment's ionChange: a scrollable segment has no swipe to
 * select, so a tap is every way a tab gets picked.
 */
export default function Tabs({ items, value, onChange, label, centered = false }) {
  return (
    <IonSegment
      mode="md"
      scrollable
      value={value}
      aria-label={label}
      className={`house-tabs ${centered ? 'house-tabs-centered' : ''}`.trim()}
    >
      {items.map((item) => (
        <IonSegmentButton
          key={item.id}
          value={item.id}
          layout="icon-start"
          onClick={() => {
            if (item.id !== value) onChange(item.id)
          }}
        >
          {item.icon ? <IonIcon icon={item.icon} aria-hidden="true" /> : null}
          <IonLabel>{item.label}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  )
}
