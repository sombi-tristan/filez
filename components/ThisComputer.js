'use client'

import { useRef, useState } from 'react'
import { Download, Upload, KeyRound, Loader2, AlertTriangle } from 'lucide-react'
import Modal from '@/components/Modal'
import { INPUT, BTN_PRIMARY, BTN_FRAMED, BTN_DANGER, CARD, SectionHeader } from '@/components/ui'

/**
 * Desktop build: the station's data lives only on this computer, so the hub carries the tools
 * that look after it — a backup file the owner can copy to a flash drive, restoring one, and
 * changing your own PIN.
 */
export default function ThisComputer({ isOwner, stationName }) {
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState(null) // { title, text }
  const [restoreFile, setRestoreFile] = useState(null)
  const [pinOpen, setPinOpen] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [pinError, setPinError] = useState('')
  const fileRef = useRef(null)

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

  const restore = async () => {
    if (!restoreFile) return
    setBusy('restore')
    try {
      const text = await restoreFile.text()
      const res = await fetch('/api/local/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Restore failed')
      window.location.href = '/auth/login'
    } catch (e) {
      setRestoreFile(null)
      setMessage({ title: 'Restore failed', text: e.message })
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
        {isOwner && (
          <>
            <button onClick={backup} disabled={!!busy} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_PRIMARY}`}>
              {busy === 'backup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Back up data
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={!!busy} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_FRAMED}`}>
              <Upload className="w-4 h-4" /> Restore backup
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => { setRestoreFile(e.target.files?.[0] || null); e.target.value = '' }} />
          </>
        )}
        <button onClick={() => { setPinOpen(true); setPinError('') }} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}>
          <KeyRound className="w-4 h-4" /> Change my PIN
        </button>
      </div>
      {isOwner && (
        <p className="text-xs text-content-faint mt-2">
          Your records are stored only on this computer. Back up regularly so a broken or stolen PC does not take them with it.
        </p>
      )}

      <Modal open={!!restoreFile} onClose={() => setRestoreFile(null)} title="Restore backup?">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">
              Everything on this computer will be replaced by <strong>{restoreFile?.name}</strong>, including staff and PINs.
              Back up first if you might need what is here now.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRestoreFile(null)} className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}>Cancel</button>
            <button onClick={restore} disabled={busy === 'restore'} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_DANGER}`}>
              {busy === 'restore' && <Loader2 className="w-4 h-4 animate-spin" />} Replace and restore
            </button>
          </div>
        </div>
      </Modal>

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
