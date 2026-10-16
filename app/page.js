'use client'

import '@/lib/local/installFetch'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionUserId } from '@/lib/local/session'
import { getLinkedStationId } from '@/lib/local/link'

// Desktop build: the app opens here. Signed in → the station; otherwise → sign-in / first run.
export default function Start() {
  const router = useRouter()
  useEffect(() => {
    router.replace(getSessionUserId() ? `/dashboard/stations/${getLinkedStationId()}` : '/auth/login')
  }, [router])
  return null
}
