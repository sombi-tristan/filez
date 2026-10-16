'use client'

import { IonIcon, useIonRouter } from '@ionic/react'
import { chevronForward } from 'ionicons/icons'
import { Badge, IconChip } from './Card.jsx'

// A tile is a button that goes somewhere: a path is pushed, an onClick is called.
function useOpen(href, onClick) {
  const router = useIonRouter()
  return (e) => {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (href) router.push(href)
  }
}

/**
 * A square tile on a dashboard grid: the icon chip top left, the label bottom left (it wraps;
 * a long word breaks rather than running off the edge), a chevron top right. `desc` is one
 * quiet line under the label, drawn only when there is one. Dressed by `.house-tile`.
 */
export function Tile({ href, onClick, label, desc, icon }) {
  const open = useOpen(href, onClick)
  return (
    <button type="button" className="house-tile" onClick={open}>
      <IonIcon icon={chevronForward} className="house-tile-go" aria-hidden="true" />
      <IconChip icon={icon} size={40} />
      <span className="house-tile-label">{label}</span>
      {desc ? <span className="house-tile-desc">{desc}</span> : null}
    </button>
  )
}

/**
 * The larger tile for a screen's one or two main actions. `solid` fills it with the accent (the
 * primary one); without it the tile is tinted. `badge` is a count in its corner.
 */
export function HeroTile({ href, onClick, label, desc, icon, solid = false, badge }) {
  const open = useOpen(href, onClick)
  return (
    <button type="button" className={`house-tile house-tile-hero ${solid ? 'house-tile-solid' : ''}`.trim()} onClick={open}>
      <Badge count={badge} className="house-tile-badge" />
      <IconChip icon={icon} size={40} variant={solid ? 'onAccent' : 'tint'} />
      <span className="house-tile-words">
        <span className="house-tile-label">{label}</span>
        {desc ? <span className="house-tile-desc">{desc}</span> : null}
      </span>
    </button>
  )
}
