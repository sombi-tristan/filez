'use client'

import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { store } from '@/lib/local/store'
import { getLink, updateLink } from '@/lib/local/link'
import { pull, push } from '@/lib/local/webSync'
import { useLicence } from '@/components/desktop/LicenceGate'

/**
 * Desktop build: keeps this computer and its web station in step without anyone pressing Push
 * or Pull, so entries the staff make on their phones reach the computer's reports by themselves.
 *
 *   - Pull when the app opens, every PULL_EVERY while it runs, and when the internet comes back.
 *   - Push PUSH_AFTER the last change made here (more changes restart the wait).
 *
 * Only for a linked computer with a subscription running (`paid`), as the buttons are, and only
 * while the computer is online. Failures are quiet: the station page shows the last one
 * (link.syncError) and the next round tries again. The buttons still push and pull at once;
 * lib/local/webSync.js makes the two take turns.
 */
const PULL_EVERY = 10 * 60 * 1000
const PUSH_AFTER = 60 * 1000

function note(result) {
  if (!getLink()) return
  updateLink({ syncError: result?.ok || result?.unpaid ? null : (result?.error || 'Sync failed'), lastSyncAt: new Date().toISOString() })
}

export default function AutoSync() {
  const licence = useLicence()
  const on = Boolean(licence?.paid) && Boolean(getLink())
  const pending = useLiveQuery(() => store.outbox.count(), [], 0)
  const busy = useRef(false)

  // Pull, then push anything waiting: on opening, on a timer, and when back online.
  useEffect(() => {
    if (!on) return
    const round = async () => {
      if (busy.current || !navigator.onLine) return
      busy.current = true
      try {
        const pulled = await pull().catch((e) => ({ ok: false, error: e.message }))
        note(pulled)
        if (pulled.ok && (await store.outbox.count()) > 0) note(await push().catch((e) => ({ ok: false, error: e.message })))
      } finally {
        busy.current = false
      }
    }
    round()
    const timer = setInterval(round, PULL_EVERY)
    window.addEventListener('online', round)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', round)
    }
  }, [on])

  // Push a minute after the last change made here.
  useEffect(() => {
    if (!on || !pending) return
    const timer = setTimeout(() => {
      if (!navigator.onLine) return
      push().then(note, (e) => note({ ok: false, error: e.message }))
    }, PUSH_AFTER)
    return () => clearTimeout(timer)
  }, [on, pending])

  return null
}
