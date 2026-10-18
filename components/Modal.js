'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Scrim at 70%: 40% left the panel floating ambiguously over the page, and in dark
          mode a dark panel on a dark background barely reads at all. */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      {/* border-line is gray-400 in light mode, identical to what this carried before. The
          dark override is brighter than the token: a dark panel on a dark scrim needs more
          edge than a divider does. */}
      <div className="relative bg-surface border-card border-line dark:border-white/30 rounded-house w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-content">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1 text-content-faint hover:text-content-strong">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
