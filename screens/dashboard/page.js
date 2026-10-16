'use client'

import { useEffect } from 'react'
import { useRouter } from '@/lib/nav'
import { getLinkedStationId } from '@/lib/local/link'

// Desktop build: one station per computer, so the station list is just that station.
export default function DashboardPage() {
  const router = useRouter()
  useEffect(() => { router.replace(`/dashboard/stations/${getLinkedStationId()}`) }, [router])
  return null
}
