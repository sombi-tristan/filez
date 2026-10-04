'use client'

import { createContext, useContext, useCallback } from 'react'
import { processQueue } from '@/lib/sync'

const SavePushContext = createContext(null)

/**
 * Access the "push to server after save" prompt. Call `promptPush(onProceed)`
 * right after a successful local save: it opens a modal asking whether to push
 * the queued changes now, then runs `onProceed` (e.g. navigate to the list)
 * whether the user pushes or defers. Background sync still catches deferrals.
 */
export function useSavePush() {
  const ctx = useContext(SavePushContext)
  if (!ctx) throw new Error('useSavePush must be used within SavePushProvider')
  return ctx
}

export default function SavePushProvider({ children }) {
  // Desktop build: nothing to push to. The entry is already on this computer; finish writing it
  // into the station's records in the background and carry straight on.
  const promptPush = useCallback((onProceed) => {
    processQueue().catch((e) => console.error('[SavePush] local write failed:', e))
    if (typeof onProceed === 'function') onProceed()
  }, [])

  return (
    <SavePushContext.Provider value={{ promptPush }}>
      {children}
    </SavePushContext.Provider>
  )
}
