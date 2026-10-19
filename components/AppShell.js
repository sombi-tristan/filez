'use client'

// Android app only: /api requests go to the site (lib/appFetch.js). A no-op on the website.
import '@/lib/appFetch'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { IS_APP } from '@/lib/platform'

export default function AppShell({ children }) {
  // The Android app has no middleware.js, so it checks here what the website's middleware does:
  // /dashboard needs a signed-in user, or it goes to the login page and back after. The app has
  // no home page to show; it opens the dashboard. On the website this shows the page at once.
  const [ready, setReady] = useState(!IS_APP)
  useEffect(() => {
    if (!IS_APP) return
    const { pathname, search } = window.location
    if (pathname === '/') return window.location.replace('/dashboard')
    if (!pathname.startsWith('/dashboard')) return setReady(true)
    // Without Supabase settings the login page shows the error; a blank app would hide it.
    if (!supabase) return setReady(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
      else window.location.replace(`/auth/login?next=${encodeURIComponent(pathname + search)}`)
    })
  }, [])

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
  return <>{ready ? children : null}</>
}
