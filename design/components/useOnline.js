'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'

function subscribe(change) {
  window.addEventListener('online', change)
  window.addEventListener('offline', change)
  return () => {
    window.removeEventListener('online', change)
    window.removeEventListener('offline', change)
  }
}

/**
 * Whether the device has a network. `navigator.onLine` false is certain (no network at all);
 * true only means a network exists, so a dead server still reads as online.
 */
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true)
}

/** Calls `onRetry` once when the connection comes back after being gone. */
export function useRetryOnReconnect(online, onRetry) {
  const retry = useRef(onRetry)
  useEffect(() => {
    retry.current = onRetry
  })
  const wasOffline = useRef(!online)
  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      retry.current?.()
    }
  }, [online])
}
