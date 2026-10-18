'use client'

import { useState } from 'react'
import { Download, Upload, Loader2, ChevronRight } from 'lucide-react'
import Modal from '@/components/Modal'
import { useLicence, PaidNote } from '@/components/desktop/LicenceGate'
import { BTN_PRIMARY, IconChip } from '@/components/ui'
import RestoreBackup from '@/components/desktop/RestoreBackup'

// A list card, like the station home's "View all reports": icon, name and a line, an arrow.
const LIST_CARD = 'w-full flex items-center gap-3 p-3 bg-subtle rounded-house text-left transition-colors hover:bg-primary-500/10 disabled:opacity-50'

function CardBody({ icon, busy, title, line }) {
  return (
    <>
      {busy ? <span className="w-10 h-10 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" /></span> : <IconChip icon={icon} className="w-10 h-10" iconClass="w-5 h-5" />}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-content">{title}</span>
        <span className="block text-xs text-content-muted">{line}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-content-faint flex-shrink-0" />
    </>
  )
}

/**
 * Desktop build: the station's data lives only on this computer, so the hub carries the tools
 * that look after it: a backup file of this station the owner can copy to a flash drive,
 * restoring one as a station here (components/desktop/RestoreBackup.js).
 *
 * Backup and restore need a subscription running (components/desktop/LicenceGate.js `paid`).
 */
export default function ThisComputer({ isOwner, stationName }) {
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null) // { title, text }
  const paid = Boolean(useLicence()?.paid)

  const backup = async () => {
    setBusy('backup')
    try {
      const res = await fetch('/api/local/backup')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Backup failed')
      const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
      const safe = (stationName || 'station').replace(/[^\w-]+/g, '_')
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `StationMGR_${safe}_${stamp}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      setMessage({ title: 'Backup saved', text: 'Keep the file somewhere other than this computer: a flash drive or your email.' })
    } catch (e) {
      setMessage({ title: 'Backup failed', text: e.message })
    }
    setBusy('')
  }

  // Only the owner looks after the records here: staff have nothing to do in this section.
  if (!isOwner) return null

  return (
    <section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">
      <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">This computer</h2>
      {isOwner && paid && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={backup} disabled={!!busy} className={LIST_CARD}>
            <CardBody icon={Download} busy={busy === 'backup'} title="Back up data" line="Save this station to a file" />
          </button>
          <RestoreBackup disabled={!!busy} className={LIST_CARD}>
            <CardBody icon={Upload} title="Restore backup" line="Overwrite or pad from a backup file" />
          </RestoreBackup>
        </div>
      )}
      {isOwner && !paid && (
        <div className="mt-2"><PaidNote what="Backing up and restoring stations" /></div>
      )}
      {isOwner && (
        <p className="text-xs text-content-faint mt-2">
          Your records are stored only on this computer. Back up regularly so a broken or stolen PC does not take them with it.
        </p>
      )}

      <Modal open={!!message} onClose={() => setMessage(null)} title={message?.title || ''}>
        <div className="space-y-4">
          <p className="text-sm text-content-strong">{message?.text}</p>
          <button onClick={() => setMessage(null)} className={`w-full py-2 text-sm font-medium ${BTN_PRIMARY}`}>OK</button>
        </div>
      </Modal>
    </section>
  )
}
