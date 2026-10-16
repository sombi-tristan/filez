import DashboardApp from './DashboardApp'

/**
 * Desktop build: the static export writes this one page (out/dashboard.html). Every other
 * /dashboard address is answered with it by electron/resolve.js, and the Ionic app inside routes
 * it, so no station id has to be known when the app is built.
 */
export function generateStaticParams() {
  return [{ path: [] }]
}

export default function Page() {
  return <DashboardApp />
}
