'use client'

import dynamic from 'next/dynamic'
import { ShellSkeleton } from '@/components/Skeletons'

/**
 * Every /dashboard address (mounted by page.js). The dashboard is one Ionic app
 * (components/shell/IonicShell.js) with its own router, so this only mounts it, in the browser:
 * Ionic's components and its router need the window, and the screens read IndexedDB, not the
 * server. Until it has loaded, a skeleton of a screen.
 */
const IonicShell = dynamic(() => import('@/components/shell/IonicShell'), { ssr: false, loading: () => <ShellSkeleton /> })

export default function DashboardApp() {
  return <IonicShell area="/dashboard" />
}
