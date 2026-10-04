import { LOCAL_STATION_ID } from '@/lib/local/constants'

// Desktop build: one station, known ahead of time, so this route can be exported as a static
// page (Next needs every value of a dynamic segment at build time for `output: 'export'`).
export function generateStaticParams() {
  return [{ stationId: LOCAL_STATION_ID }]
}

export const dynamicParams = false

export default function StationLayout({ children }) {
  return children
}
