'use client'

import { alertCircleOutline, cloudOfflineOutline } from 'ionicons/icons'
import Button from './Button.jsx'
import { SheetHero } from './Sheet.jsx'
import { useOnline, useRetryOnReconnect } from './useOnline.js'

/**
 * What a screen shows when its load failed. Offline, it says so and the screen reloads by
 * itself when the connection returns. Online, the failure is a real one: `message` says what
 * failed and `children` say why (the server's own words), with a Try again.
 *
 *   onRetry   called by Try again, and by itself when the connection comes back
 *   message   what did not load
 *   children  the reason, shown only while online
 */
export default function LoadFailed({ onRetry, message = 'That did not load.', children = null, className = '' }) {
  const online = useOnline()
  useRetryOnReconnect(online, onRetry)
  return (
    <div className={`house-failed ${className}`.trim()} data-offline={online ? undefined : 'true'}>
      <SheetHero icon={online ? alertCircleOutline : cloudOfflineOutline} title={online ? message : "You're offline"} />
      {online && children ? <div className="house-failed-why">{children}</div> : null}
      {onRetry ? (
        <Button variant="neutral" onClick={onRetry} expand="inline">
          Try again
        </Button>
      ) : null}
    </div>
  )
}
