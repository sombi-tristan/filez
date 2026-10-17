'use client'

import '@/lib/local/installFetch'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionUserId } from '@/lib/local/session'

// Desktop build: the app opens here. Signed in → the station; otherwise → sign-in / first run.
export default function Start() {
  const router = useRouter()
  useEffect(() => {
    router.replace(getSessionUserId() ? '/dashboard' : '/auth/login')
  }, [router])
  return null
}
