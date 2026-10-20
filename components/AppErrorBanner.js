'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { IS_APP } from '@/lib/platform'

/**
 * Android app only: an error nothing caught (a crash in a screen, a request that failed with no
 * handler) shows its own message across the top, instead of the screen freezing with no sign of
 * why. Added after Station Settings stopped responding to taps on phones with nothing to show for
 * it. The newest error is on top; Close clears them.
 */
export default function AppErrorBanner() {
  const [errors, setErrors] = useState([])

  useEffect(() => {
    if (!IS_APP) return
    const add = (text) => setErrors((list) => [text, ...list.filter((t) => t !== text)].slice(0, 3))
    const onError = (e) => {
      const where = e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno}:${e.colno})` : ''
      add(`${e.error?.message || e.message || 'Unknown error'}${where}`)
    }
    const onRejection = (e) => add(e.reason?.message || String(e.reason || 'A request failed'))
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!errors.length) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-[10000] flex items-start gap-2 px-4 pb-3 bg-red-600 text-white text-sm shadow-lg"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
    >
      <div className="flex-1 min-w-0 space-y-1 break-words">
        {errors.map((text) => <p key={text}>{text}</p>)}
      </div>
      <button type="button" aria-label="Close" onClick={() => setErrors([])} className="p-1 -m-1 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
