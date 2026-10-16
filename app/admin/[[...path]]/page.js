'use client'

import dynamic from 'next/dynamic'

/**
 * Every /admin address: the admin area as one Ionic app (components/shell/IonicShell.js).
 * middleware.js checks the admin role when this page is loaded, which is every way in: the
 * dashboard's app reaches /admin with a full page load, never inside its own stack.
 */
const IonicShell = dynamic(() => import('@/components/shell/IonicShell'), { ssr: false })

export default function AdminApp() {
  return <IonicShell area="/admin" />
}
