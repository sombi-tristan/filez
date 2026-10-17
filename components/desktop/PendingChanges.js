'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from '@/components/Modal'
import { allLinks } from '@/lib/local/link'
import { pendingChanges, describeChanges, discardChanges } from '@/lib/local/outbox'
import { fmtDate } from '@/lib/formatDate'
import { BTN_DANGER, BTN_FRAMED } from '@/components/ui'

/**
 * Desktop build: a station's changes waiting to push, to tick and discard the ones that should
 * not go to the web (components/StationWallet.js opens it). A discarded change goes back to the
 * web's version at the next pull; a new entry that never went up is removed then.
 *
 *   onDiscarded(count)  after discarding, so the page can pull at once
 */
export default function PendingChanges({ open, onClose, stationId, onDiscarded }) {
  const [changes, setChanges] = useState(null)
  const [picked, setPicked] = useState(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setChanges(null); setPicked(new Set()); setConfirming(false)
    pendingChanges(stationId, { legacyStationId: allLinks()[0]?.stationId })
      .then(describeChanges)
      .then(setChanges)
  }, [open, stationId])

  const toggle = (key) => setPicked((p) => {
    const next = new Set(p)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const allPicked = changes && changes.length > 0 && picked.size === changes.length

  const discard = async () => {
    setBusy(true)
    await discardChanges([...picked])
    setBusy(false)
    onDiscarded?.(picked.size)
    onClose()
  }

  return (
    <Modal open={open} onClose={() => { if (!busy) onClose() }} title="Changes waiting to push">
      {!changes ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-content-faint" /></div>
      ) : changes.length === 0 ? (
        <p className="text-sm text-content-muted">Nothing is waiting to push.</p>
      ) : confirming ? (
        <div className="space-y-4">
          <p className="text-sm text-content">
            Discard {picked.size} change{picked.size === 1 ? '' : 's'}? They will not go to the web. On this computer they go back to
            the web&apos;s version at the next pull, and a new entry that never went up is removed.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} disabled={busy} className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}>Back</button>
            <button onClick={discard} disabled={busy} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_DANGER}`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Discard
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-content">
            <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(changes.map((c) => c.key)))} />
            All {changes.length}
          </label>
          <ul className="max-h-80 overflow-y-auto divide-y divide-line border-2 border-line">
            {changes.map((c) => (
              <li key={c.key}>
                <label className="flex items-center gap-3 px-3 py-2 text-sm text-content">
                  <input type="checkbox" checked={picked.has(c.key)} onChange={() => toggle(c.key)} />
                  <span className="flex-1 min-w-0 truncate">
                    {c.label}
                    {c.date ? ` · ${fmtDate(c.date)}` : ''}
                    {c.name ? ` · ${c.name}` : ''}
                    {c.deleted ? ' · deleted' : ''}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button onClick={onClose} className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}>Close</button>
            <button onClick={() => setConfirming(true)} disabled={!picked.size} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 ${BTN_DANGER}`}>
              Discard {picked.size || ''}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
