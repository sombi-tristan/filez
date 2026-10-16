'use client'

import { useState } from 'react'
import { Download, KeyRound, Loader2 } from 'lucide-react'
import Modal from '@/components/Modal'
import { useLicence, PaidNote } from '@/components/desktop/LicenceGate'
import { INPUT, BTN_PRIMARY, BTN_FRAMED, CARD, SectionHeader } from '@/components/ui'
import RestoreBackup from '@/components/desktop/RestoreBackup'

/**
 * Desktop build: the station's data lives only on this computer, so the hub carries the tools
 * that look after it: a backup file of this station the owner can copy to a flash drive,
 * restoring one as a station here (components/desktop/RestoreBackup.js), and changing your PIN.
 *
 * Backup and restore need a subscription running (components/desktop/LicenceGate.js `paid`).
 */
export default function ThisComputer({ isOwner, stationName }) {
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null) // { title, text }
  const [pinOpen, setPinOpen] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState('')
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

  const changePin = async (e) => {
    e.preventDefault()
    setBusy('pin'); setPinError('')
    const res = await fetch('/api/local/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) { setPinError(body.error || 'Could not change PIN'); return }
    setPinOpen(false); setCurrentPin(''); setNewPin('')
    setMessage({ title: 'PIN changed', text: 'Use the new PIN next time you sign in.' })
  }

  return (
    <section className="mb-8">
      <SectionHeader>This computer</SectionHeader>
      <div className={`p-3 flex flex-wrap gap-2 ${CARD}`}>
        {isOwner && paid && (
          <>
            <button onClick={backup} disabled={!!busy} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_PRIMARY}`}>
              {busy === 'backup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Back up data
            </button>
            <RestoreBackup disabled={!!busy} />
          </>
        )}
        <button onClick={() => { setPinOpen(true); setPinError('') }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}>
          <KeyRound className="w-4 h-4" /> Change my PIN
        </button>
      </div>
      {isOwner && !paid && (
        <div className="mt-2"><PaidNote what="Backing up and restoring stations" /></div>
      )}
      {isOwner && (
        <p className="text-xs text-content-faint mt-2">
          Your records are stored only on this computer. Back up regularly so a broken or stolen PC does not take them with it.
        </p>
      )}

      <Modal open={pinOpen} onClose={() => setPinOpen(false)} title="Change my PIN">
        <form onSubmit={changePin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-strong mb-1">Current PIN</label>
            <input type="password" inputMode="numeric" value={currentPin} maxLength={8}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))} className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-strong mb-1">New PIN (4-8 digits)</label>
            <input type="password" inputMode="numeric" value={newPin} maxLength={8}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} className={INPUT} />
          </div>
          {pinError && <p className="text-sm text-red-600 dark:text-red-400">{pinError}</p>}
          <button type="submit" disabled={busy === 'pin' || newPin.length < 4 || currentPin.length < 4}
            className={`w-full py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_PRIMARY}`}>
            {busy === 'pin' && <Loader2 className="w-4 h-4 animate-spin" />} Save PIN
          </button>
        </form>
      </Modal>

      <Modal open={!!message} onClose={() => setMessage(null)} title={message?.title || ''}>
        <div className="space-y-4">
          <p className="text-sm text-content-strong">{message?.text}</p>
          <button onClick={() => setMessage(null)} className={`w-full py-2 text-sm font-medium ${BTN_PRIMARY}`}>OK</button>
        </div>
      </Modal>
    </section>
  )
}
