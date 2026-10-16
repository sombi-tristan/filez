'use client'

import { IonIcon } from '@ionic/react'

/**
 * What a whole view shows when it has nothing: an icon, a title, a line, and one action. An
 * empty table inside a view that has other things keeps a quiet one-line message instead, or a
 * page of sections becomes a page of placeholders. Dressed by `.house-empty`.
 *
 *   icon    an ionicons/icons value
 *   action  a Button
 */
export default function EmptyState({ icon, title, children, action, className = '' }) {
  return (
    <div className={`house-empty ${className}`.trim()}>
      {icon ? <IonIcon icon={icon} aria-hidden="true" /> : null}
      {title ? <p className="house-empty-title">{title}</p> : null}
      {children ? <p className="house-empty-line">{children}</p> : null}
      {action ? <div className="house-empty-action">{action}</div> : null}
    </div>
  )
}
