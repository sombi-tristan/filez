'use client'

import { useState, useEffect } from 'react'
import { db } from '@/lib/db'

/**
 * Hook to check if the current user has access to a specific page/feature
 * and whether they are the station owner.
 *
 * Online: fetches from API, caches result in IndexedDB.
 * Offline: falls back to cached result so pages still render.
 *
 * @param {string} orgId - The organization/station ID
 * @param {string} pageKey - The permission key (e.g. 'report-audit', 'imprest')
 * @returns {{ loading: boolean, allowed: boolean, isOwner: boolean, visiblePages: string[] }}
 */
export function usePageAccess(orgId, pageKey) {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [isOwner, setIsOwner] = useState(false)
  const [visiblePages, setVisiblePages] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }

    let cancelled = false
    const cacheKey = `${orgId}:${pageKey}`

    const check = async () => {
      try {
        // Check ownership
        const orgRes = await fetch('/api/organizations')
        if (cancelled) return
        const orgData = orgRes.ok ? await orgRes.json() : {}
        const owned = (orgData.stations || []).some(s => s.id === orgId)
        setIsOwner(owned)

        if (owned) {
          // Owner has access to everything
          setAllowed(true)
          setVisiblePages([])
          // Cache the result
          await db.accessCache.put({ key: cacheKey, isOwner: true, allowed: true, visiblePages: [] }).catch(() => {})
          if (!cancelled) setLoading(false)
          return
        }

        // Staff — check permissions
        const permRes = await fetch(`/api/invites?org_id=${orgId}`)
        if (cancelled) return
        const permData = permRes.ok ? await permRes.json() : {}
        const pages = permData.visiblePages || []
        const hasAccess = pages.includes(pageKey)
        setVisiblePages(pages)
        setAllowed(hasAccess)
        // Cache the result
        await db.accessCache.put({ key: cacheKey, isOwner: false, allowed: hasAccess, visiblePages: pages }).catch(() => {})
      } catch {
        // Offline or network error — fall back to cached permissions
        try {
          // This page's own answer, or else the station's from any page opened online (who
          // owns it and which pages a member holds are the same for every page).
          const cached = await db.accessCache.get(cacheKey)
            || await db.accessCache.filter((c) => c.key.startsWith(`${orgId}:`)).first()
          if (cached && !cancelled) {
            const pages = cached.visiblePages || []
            setIsOwner(cached.isOwner)
            setAllowed(cached.isOwner || pages.includes(pageKey))
            setVisiblePages(pages)
          } else {
            setAllowed(false)
          }
        } catch {
          setAllowed(false)
        }
      }
      if (!cancelled) setLoading(false)
    }
    check()
    return () => { cancelled = true }
  }, [orgId, pageKey])

  return { loading, allowed, isOwner, visiblePages }
}
