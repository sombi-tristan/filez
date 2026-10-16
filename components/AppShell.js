'use client'

import { useEffect } from 'react'

export default function AppShell({ children }) {
  useEffect(() => {
    // Force-update stale service workers and clear old API caches
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return
        reg.update()
        const activate = (sw) => sw.postMessage({ type: 'SKIP_WAITING' })
        if (reg.waiting) activate(reg.waiting)
        reg.addEventListener('updatefound', () => {
          const newSw = reg.installing
          if (!newSw) return
          newSw.addEventListener('statechange', () => {
            if (newSw.state === 'installed' && reg.waiting) activate(reg.waiting)
          })
        })
      })
      // Caches left behind by the old worker. Until the runtimeCaching fix in
      // next.config.mjs, a top-level `runtimeCaching` key was silently ignored and the
      // worker ran next-pwa's default cache, which stored page documents, RSC payloads and
      // API responses. The new worker never reads these, so every existing install is
      // carrying dead weight (and a stale copy of the app) until they are removed.
      // Safe to drop this list once the fix has been live long enough for everyone to
      // have loaded the app at least once.
      for (const name of ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'next-data', 'others']) {
        caches.delete(name).catch(() => {})
      }
    }
  }, [])

  // The dashboard and the admin area draw their own top bar, menu and screens as Ionic apps
  // (components/shell/IonicShell.js). Everything else (home, auth, offline) is a plain page.
  return <>{children}</>
}
