'use client'

import { useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { store } from '@/lib/local/store'
import { allLinks, updateLink } from '@/lib/local/link'
import { pendingCount } from '@/lib/local/outbox'
import { checkLicence, paidNow } from '@/lib/local/licence'
import { pull, push, refreshLicence } from '@/lib/local/webSync'

/**
 * Desktop build: keeps every linked station on this computer and its web station in step
 * without anyone pressing Push or Pull, so entries the staff make on their phones reach the
 * computer's reports by themselves. A computer holds several stations; each linked one with a
 * subscription running syncs, whichever is open.
 *
 *   - Pull when the app opens, every PULL_EVERY while it runs, and when the internet comes back.
 *   - Push PUSH_AFTER the last change made here (more changes restart the wait).
 *
 * Only while the computer is online. Failures are quiet: the station page shows each station's
 * last one (link.syncError) and the next round tries again. The buttons still push and pull at
 * once; lib/local/webSync.js makes the calls take turns.
 */
const PULL_EVERY = 10 * 60 * 1000
const PUSH_AFTER = 60 * 1000

function note(stationId, result) {
  updateLink({ syncError: result?.ok || result?.unpaid ? null : (result?.error || 'Sync failed'), lastSyncAt: new Date().toISOString() }, stationId)
}

const failed = (e) => ({ ok: false, error: e.message })

/** The linked stations with a subscription running, their licences checked (and renewed online). */
async function syncingStations() {
  const ids = []
  for (const { stationId, revoked } of allLinks()) {
    if (revoked) continue
    if (navigator.onLine) await refreshLicence(stationId).catch(() => {})
    await checkLicence(Date.now(), stationId)
    if (paidNow(stationId)) ids.push(stationId)
  }
  return ids
}

export default function AutoSync() {
  const pending = useLiveQuery(() => store.outbox.count(), [], 0)
  const busy = useRef(false)

  // Pull, then push anything waiting, for each station: on opening, on a timer, and when back online.
  useEffect(() => {
    const round = async () => {
      if (busy.current || !navigator.onLine) return
      busy.current = true
      try {
        for (const stationId of await syncingStations()) {
          const pulled = await pull({ stationId }).catch(failed)
          note(stationId, pulled)
          if (pulled.ok && (await pendingCount(stationId)) > 0) note(stationId, await push(stationId).catch(failed))
        }
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
  }, [])

  // Push a minute after the last change made here, for each station that has changes waiting.
  useEffect(() => {
    if (!pending) return
    const timer = setTimeout(async () => {
      if (!navigator.onLine) return
      for (const stationId of await syncingStations()) {
        if ((await pendingCount(stationId)) > 0) note(stationId, await push(stationId).catch(failed))
      }
    }, PUSH_AFTER)
    return () => clearTimeout(timer)
  }, [pending])

  return null
}
