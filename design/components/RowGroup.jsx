'use client'

import { IonIcon, useIonRouter } from '@ionic/react'
import { chevronForward } from 'ionicons/icons'
import { Badge, IconChip } from './Card.jsx'

/** Rows inside one bordered container, a line between each. Dressed by `.house-rows`. */
export function RowGroup({ className = '', children }) {
  return <div className={`house-rows ${className}`.trim()}>{children}</div>
}

/**
 * A dashboard row: an icon chip, a label over a quiet line, a count, a chevron. For a plain
 * Settings row (a value, a switch) use ListRow.
 */
export function Row({ href, onClick, label, desc, icon, badge }) {
  const router = useIonRouter()
  return (
    <button
      type="button"
      className="house-rows-row"
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (href) router.push(href)
      }}
    >
      {icon ? <IconChip icon={icon} /> : null}
      <span className="house-rows-words">
        <span className="house-rows-label">{label}</span>
        {desc ? <span className="house-rows-desc">{desc}</span> : null}
      </span>
      <Badge count={badge} />
      <IonIcon icon={chevronForward} className="house-rows-go" aria-hidden="true" />
    </button>
  )
}
