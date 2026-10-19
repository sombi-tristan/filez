import DashboardApp from './DashboardApp'

/**
 * Android app build (static export): it writes this one page (dashboard.html), and the app
 * answers every other /dashboard address with it; the Ionic app inside routes it, so no station
 * id has to be known when the app is built. On the website every address still renders here.
 */
export function generateStaticParams() {
  return [{ path: [] }]
}

export default function Page() {
  return <DashboardApp />
}
