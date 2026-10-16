'use client'

import { useEffect, useState } from 'react'
import { Loader2, Store, Globe, Upload } from 'lucide-react'
import { INPUT, LABEL, BTN_PRIMARY, BTN_FRAMED, CARD } from '@/components/ui'
import LinkForm from '@/components/desktop/LinkForm'
import RestoreBackup from '@/components/desktop/RestoreBackup'
import { PaidNote } from '@/components/desktop/LicenceGate'
import { allLinks } from '@/lib/local/link'
import { checkLicence, paidNow } from '@/lib/local/licence'

/**
 * Desktop build: the owner adds a station to this computer (screens/dashboard/page.js). A
 * computer holds several stations side by side; adding one never touches the others.
 *
 *   offline   a new station, named here; it opens on the setup wizard (pumps, tanks, opening
 *             balances) and can be linked to the web later
 *   web       one of the owner's web stations, brought down with its records (LinkForm with no
 *             station here to link: it becomes a new station on this computer)
 *   backup    a backup file becomes a station here (components/desktop/RestoreBackup.js); like
 *             backing up, it needs a subscription running
 *
 *   onAdded(station)  called with the new station (or null) once it is here
 */
export default function AddStation({ onAdded, onCancel }) {
  const [way, setWay] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Restoring needs a subscription running on any station here, as the in-app server checks.
  const [paid, setPaid] = useState(false)
  useEffect(() => {
    Promise.all(allLinks().map((l) => checkLicence(Date.now(), l.stationId)))
      .then(() => setPaid(allLinks().some((l) => paidNow(l.stationId))))
  }, [])

  const createOffline = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const res = await fetch('/api/local/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(body.error || 'Could not add the station'); return }
    onAdded?.(body.station)
  }

  const choice = (key, Icon, title, text) => (
    <button type="button" onClick={() => { setWay(key); setError('') }} className={`w-full text-left flex items-start gap-3 p-3 ${CARD}`}>
      <Icon className="w-5 h-5 text-accent mt-0.5 shrink-0" />
      <span>
        <span className="block text-sm font-semibold text-content">{title}</span>
        <span className="block text-xs text-content-muted">{text}</span>
      </span>
    </button>
  )

  return (
    <div className={`p-4 space-y-3 ${CARD}`}>
      <h2 className="text-sm font-semibold text-content">Add a station to this computer</h2>

      {!way && (
        <div className="space-y-2">
          {choice('offline', Store, 'Create a new one', 'Name it, then set up its pumps, tanks and opening balances. No internet needed.')}
          {choice('web', Globe, 'Bring one from the web', 'Sign in with your StationMGR web account and pick a station; its records come down.')}
          {choice('backup', Upload, 'From a backup file', 'A backup of a station becomes another station here.')}
        </div>
      )}

      {way === 'offline' && (
        <form onSubmit={createOffline} className="space-y-3">
          <div>
            <label className={LABEL} htmlFor="new-station-name">Station name</label>
            <input id="new-station-name" value={name} onChange={(e) => { setName(e.target.value); setError('') }} maxLength={100} className={INPUT} required autoFocus />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !name.trim()} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_PRIMARY}`}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create and set up
          </button>
        </form>
      )}

      {way === 'web' && (
        <LinkForm localStationId={null} onLinked={(result) => onAdded?.(result?.station ? { ...result.station, onboarding_complete: true } : null)} />
      )}

      {way === 'backup' && (paid ? <RestoreBackup label="Choose the backup file" /> : <PaidNote what="Restoring a backup" />)}

      <button type="button" onClick={() => (way ? setWay(null) : onCancel?.())} className={`px-4 py-2 text-sm ${BTN_FRAMED}`}>
        {way ? 'Back' : 'Cancel'}
      </button>
    </div>
  )
}
