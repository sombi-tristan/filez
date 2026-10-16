'use client'

import dynamic from 'next/dynamic'

/**
 * Every /dashboard address. The dashboard is one Ionic app (components/shell/IonicShell.js)
 * with its own router, so this page only mounts it, in the browser: Ionic's components and
 * its router need the window, and the screens read IndexedDB, not the server.
 */
const IonicShell = dynamic(() => import('@/components/shell/IonicShell'), { ssr: false })

export default function DashboardApp() {
  return <IonicShell area="/dashboard" />
}
