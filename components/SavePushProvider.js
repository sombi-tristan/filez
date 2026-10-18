'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Cloud, Loader2, AlertTriangle } from 'lucide-react'
import Modal from '@/components/Modal'
import { OUTLINE } from '@/components/ui'
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
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('ask') // 'ask' | 'pushing' | 'error'
  const onProceedRef = useRef(null)

  const promptPush = useCallback((onProceed) => {
    onProceedRef.current = typeof onProceed === 'function' ? onProceed : null
    setStatus('ask')
    setOpen(true)
  }, [])

  const proceed = useCallback(() => {
    const fn = onProceedRef.current
    onProceedRef.current = null
    setOpen(false)
    if (fn) fn()
  }, [])

  const handlePushNow = useCallback(async () => {
    setStatus('pushing')
    try {
      await processQueue()
      proceed()
    } catch (e) {
      console.error('[SavePush] push failed:', e)
      setStatus('error')
    }
  }, [proceed])

  return (
    <SavePushContext.Provider value={{ promptPush }}>
      {children}
      <Modal open={open} onClose={proceed} title="Entry saved">
        {status === 'error' ? (
          <>
            <div className="flex items-start gap-2 mb-5">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-sm text-content-muted">
                Couldn&apos;t reach the server. Your entry is saved on this device and will sync
                automatically once you&apos;re back online.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={proceed}
                className={`px-4 py-2 text-sm font-medium ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-content-muted mb-5">
              Your entry is saved on this device. Push it to the server now?
            </p>
            {/* Later is the quiet variant and Push now the emphasised one. They used to be a
                gray-bordered box beside a solid blue fill, which read as equal weight; the
                system separates them by how hard the outline is drawn. Padding unchanged. */}
            <div className="flex justify-end gap-2">
              <button
                onClick={proceed}
                disabled={status === 'pushing'}
                className="px-4 py-2 text-sm font-medium text-content-muted hover:text-content hover:bg-subtle transition-all disabled:opacity-50"
              >
                Later
              </button>
              <button
                onClick={handlePushNow}
                disabled={status === 'pushing'}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30 disabled:opacity-50"
              >
                {status === 'pushing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                Push now
              </button>
            </div>
          </>
        )}
      </Modal>
    </SavePushContext.Provider>
  )
}
