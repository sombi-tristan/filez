'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { OUTLINE } from '@/components/ui'

export default function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true)
    }

    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setInstalled(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const installedHandler = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    } else {
      setShowGuide(true)
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-install-dismissed', '1')
    setDismissed(true)
  }

  if (installed || dismissed) return null

  return (
    <>
      {/* Was green throughout. Green is a STATE colour in this system (good / succeeded),
          and "install our app" is an invitation, not a state — so under the one-accent rule
          this becomes the brand blue like every other non-state affordance. */}
      <div className="bg-primary-50 dark:bg-primary-950/30 border border-primary-500/40 dark:border-primary-400/40 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-primary-600 dark:text-primary-300 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-content">Install StationMGR</p>
            <p className="text-sm text-content-muted">Install as an app for offline access and faster loading.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className={`px-3 py-1.5 text-sm font-medium ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
          >
            Install
          </button>
          <button onClick={handleDismiss} aria-label="Dismiss" className="p-1 text-content-faint hover:text-content-strong">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrim at 70%, matching Modal: at 40% the panel floated ambiguously over the page. */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowGuide(false)}>
          <div className="bg-surface border-card border-line dark:border-white/30 mx-4 p-5 max-w-sm w-full shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-content mb-3">Install StationMGR</h3>
            {isIOS ? (
              <ol className="text-sm text-content-strong space-y-2 list-decimal list-inside">
                <li>Tap the <strong>Share</strong> button (box with arrow) in Safari</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
                <li>Tap <strong>Add</strong></li>
              </ol>
            ) : (
              <ol className="text-sm text-content-strong space-y-2 list-decimal list-inside">
                <li>Tap the <strong>menu</strong> (three dots) in your browser</li>
                <li>Tap <strong>Install app</strong> or <strong>Add to Home Screen</strong></li>
              </ol>
            )}
            <button
              onClick={() => setShowGuide(false)}
              className={`mt-4 w-full py-2 text-sm font-medium ${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
