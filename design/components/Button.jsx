'use client'

import { IonButton, IonIcon, useIonRouter } from '@ionic/react'

/**
 * The button: Ionic's IonButton, dressed by `.house-btn` in design/house.css.
 *
 *   variant  'primary'   filled accent, the one main action on a screen
 *            'secondary' outlined accent
 *            'neutral'   outlined in the line colour, for Try again and the like
 *            'danger'    outlined danger, for the destructive answer
 *   expand   'block' (default) full width, or 'inline' sized to its words
 *   size     'default' (48px), 'large' (56px) or 'small' (36px, inside something else)
 *   icon     an ionicons/icons value drawn before the words
 *   href     a path pushes that screen; a full address (https://...) opens in a new tab
 */
const SIZES = { small: 'house-btn-small', large: 'house-btn-large' }

export default function Button({
  variant = 'primary',
  expand = 'block',
  size = 'default',
  // An ionicons/icons value drawn before the words.
  icon = null,
  href = null,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const router = useIonRouter()
  const outside = href && /^https?:/.test(href)
  return (
    <IonButton
      type={type}
      expand={expand === 'block' ? 'block' : undefined}
      fill={variant === 'primary' ? 'solid' : 'outline'}
      disabled={disabled}
      className={`house-btn house-btn-${variant} ${SIZES[size] || ''} ${className}`.replace(/\s+/g, ' ').trim()}
      {...(outside ? { href, target: '_blank', rel: 'noopener' } : {})}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented || outside) return
        if (href) router.push(href)
      }}
      {...rest}
    >
      {icon ? <IonIcon slot="start" icon={icon} /> : null}
      {children}
    </IonButton>
  )
}

/**
 * A square button holding one icon. `icon` is an ionicons/icons value; `label` is what a screen
 * reader says, since there are no words on it.
 */
export function IconButton({ icon, label, variant = 'secondary', onClick, disabled = false, className = '' }) {
  return (
    <IonButton
      type="button"
      fill={variant === 'primary' ? 'solid' : 'outline'}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`house-btn house-btn-${variant} house-btn-icon ${className}`.trim()}
    >
      <IonIcon slot="icon-only" icon={icon} />
    </IonButton>
  )
}
