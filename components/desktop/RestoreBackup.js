'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, AlertTriangle } from 'lucide-react'
import Modal from '@/components/Modal'
import { setCurrentStationId } from '@/lib/local/link'
import { BTN_FRAMED, BTN_PRIMARY } from '@/components/ui'

/**
 * Desktop build: restore a backup file as a station on this computer (the station page, and
 * Add a station on screens/dashboard/page.js). The backup's station is added beside the others,
 * or replaces only that same station; its setup and opening balances come in once, as they are
 * in the file (lib/local/routes/local/backup). Then it opens.
 */
export default function RestoreBackup({ disabled = false, label = 'Restore backup' }) {
  const fileRef = useRef(null)
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choose = async (picked) => {
    setError(''); setName(''); setFile(picked)
    if (!picked) return
    try { setName(JSON.parse(await picked.text())?.tables?.organizations?.[0]?.name || '') } catch { /* the restore says it is not a backup */ }
  }

  const restore = async () => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/local/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: await file.text() })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Restore failed')
      setCurrentStationId(body.station.id)
      // A full load: the station opens afresh, its screens rebuilt from what was restored.
      window.location.href = body.station.onboarding_complete ? `/dashboard/stations/${body.station.id}` : `/dashboard/setup/${body.station.id}`
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <>
      <button onClick={() => fileRef.current?.click()} disabled={disabled || busy} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_FRAMED}`}>
        <Upload className="w-4 h-4" /> {label}
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
        onChange={(e) => { choose(e.target.files?.[0] || null); e.target.value = '' }} />

      <Modal open={!!file} onClose={() => { if (!busy) setFile(null) }} title="Restore backup?">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-subtle border-2 border-line">
            <AlertTriangle className="w-5 h-5 text-content-muted flex-shrink-0 mt-0.5" />
            <p className="text-sm text-content">
              <strong>{name || file?.name}</strong> is added to this computer as a station, with its setup and opening
              balances. If it is here already, only that station is replaced by the backup. Your other stations are not touched.
            </p>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setFile(null)} disabled={busy} className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}>Cancel</button>
            <button onClick={restore} disabled={busy} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_PRIMARY}`}>
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Restore
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
