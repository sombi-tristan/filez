'use client'

import { IonIcon } from '@ionic/react'

/**
 * The flat card: a surface with a 2px line round it and the 4px corner. No shadow; the line is
 * the edge. `as` picks the element (a `section`, an `article`). Dressed by `.house-card`.
 */
export function Card({ as: As = 'div', className = '', children, ...rest }) {
  return (
    <As className={`house-card ${className}`.trim()} {...rest}>
      {children}
    </As>
  )
}

/** The heading over a group of cards or rows on a dashboard. */
export function SectionHeader({ children, className = '' }) {
  return <h2 className={`house-section ${className}`.trim()}>{children}</h2>
}

/**
 * An icon on a small square plate, tinted with the accent. `icon` is an ionicons/icons value.
 * `variant="onAccent"` for a chip that sits on a filled accent surface.
 */
export function IconChip({ icon, size = 36, variant = 'tint' }) {
  return (
    <span className={`house-chip ${variant === 'onAccent' ? 'house-chip-on' : ''}`.trim()} style={{ width: size, height: size }}>
      <IonIcon icon={icon} aria-hidden="true" />
    </span>
  )
}

/** A count on a small pill: nothing at zero, "99+" past ninety-nine. */
export function Badge({ count, className = '' }) {
  if (!count || count <= 0) return null
  return <span className={`house-count ${className}`.trim()}>{count > 99 ? '99+' : count}</span>
}
