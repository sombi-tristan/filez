'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LOCAL_STATION_ID } from '@/lib/local/constants'

// Desktop build: one station per install, so the station list is just that station.
export default function DashboardPage() {
  const router = useRouter()
  useEffect(() => { router.replace(`/dashboard/stations/${LOCAL_STATION_ID}`) }, [router])
  return null
}
