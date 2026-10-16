'use client'

import { useState } from 'react'
import { Loader2, Mail, Lock, Store, AlertTriangle } from 'lucide-react'
import { LABEL } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT } from '@/app/auth/authStyles'
import { link, finishLink } from '@/lib/local/webSync'
import { hasWebBridge } from '@/lib/local/web'

/**
 * Links this computer to its station on the web: the one step that needs the internet.
 *
 *   1. The station owner signs in with their StationMGR web email and password.
 *   2. If they own several stations, they choose one.
 *   3. If this computer already has records and the web station does too, they choose: back up
 *      this computer's records and use the station's, or cancel. Records are never merged
 *      blindly, which would put two sets of pumps and tanks into one station.
 *
 * Then the station's records come down, and a computer with records of its own sends them up.
 * `onLinked(result)` is called when it is done.
 *
 * Or the owner creates a new station on the web for this computer's records (with their setup
 * and opening balances): from the start, from the list of their stations, or when they own none.
 * It has no subscription yet, so the records go up with its first push once one is running.
 *
 *   createFor  the name to suggest for a new station (the station this computer holds)
 */
const NEW = '__new__'

export default function LinkForm({ onLinked, canBackUp = false, createFor = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [stations, setStations] = useState(null)
  const [stationId, setStationId] = useState('')
  // null: link an existing station; a string: the name of a new one to create
  const [newName, setNewName] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  if (!hasWebBridge()) {
    return <p className="text-sm text-content-muted">Linking works in the StationMGR desktop app only.</p>
  }

  const done = (result) => {
    if (result.pushed && !result.pushed.ok) setError(`Linked, but sending this computer's records failed: ${result.pushed.error}. Use Push to try again.`)
    onLinked?.(result)
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const creating = newName !== null
    setBusy(creating ? 'Creating the station on the web…' : 'Linking and getting the station’s records…')
    const result = await link(creating
      ? { email, password, createName: newName }
      : { email, password, stationId: stationId || undefined }).catch((err) => ({ ok: false, error: err.message }))
    setBusy('')
    if (result.stations) { setStations(result.stations); setStationId(result.stations[0]?.id || ''); return }
    if (result.conflict) { setConflict(result.pending); return }
    if (result.canCreate) { setNewName(createFor); setError('This account owns no station yet. Name the new one to create for this computer.'); return }
    if (!result.ok) { setError(result.error || 'Could not link this computer'); return }
    setPassword('')
    done(result)
  }

  const useStationRecords = async () => {
    setError('')
    setBusy('Getting the station’s records…')
    const result = await finishLink(conflict, { replaceLocal: true }).catch((err) => ({ ok: false, error: err.message }))
    setBusy('')
    if (!result.ok) { setError(result.error || 'Could not finish linking'); return }
    done(result)
  }

  const downloadBackup = async () => {
    const res = await fetch('/api/local/backup')
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error || 'Could not back up'); return }
    const blob = new Blob([JSON.stringify(await res.json())], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `stationmgr-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const submitCls = `w-full py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${AUTH_SUBMIT}`
  const errorBox = error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>

  if (conflict) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3 p-3 border-2 border-line rounded-house bg-subtle">
          <AlertTriangle className="w-5 h-5 shrink-0 text-content-muted mt-0.5" />
          <div className="text-sm text-content">
            <p className="font-semibold mb-1">{conflict.station.name} already has records on the web.</p>
            <p>This computer has records of its own too. They will not be mixed: this computer will use the station’s records, and its own will be replaced. Back them up first if you may need them.</p>
          </div>
        </div>
        {canBackUp && (
          <button type="button" onClick={downloadBackup} className="w-full py-2.5 text-sm font-medium border-2 border-line rounded-house">
            Back up this computer’s records
          </button>
        )}
        {errorBox}
        <button type="button" onClick={useStationRecords} disabled={Boolean(busy)} className={submitCls}>
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {busy}</> : 'Use the station’s records'}
        </button>
        <button type="button" onClick={() => setConflict(null)} disabled={Boolean(busy)} className="w-full py-2 text-sm text-content-muted">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {!stations ? (
        <>
          <div>
            <label className={LABEL} htmlFor="link-email">Your StationMGR web email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
              <input id="link-email" type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} className={AUTH_INPUT} required autoFocus />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="link-password">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
              <input id="link-password" type="password" autoComplete="off" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} className={AUTH_INPUT} required />
            </div>
          </div>
        </>
      ) : (
        <div>
          <label className={LABEL} htmlFor="link-station">Which station is this computer for?</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <select id="link-station" value={newName !== null ? NEW : stationId}
              onChange={(e) => { if (e.target.value === NEW) setNewName(createFor); else { setNewName(null); setStationId(e.target.value) } }}
              className={AUTH_INPUT} required>
              {stations.map((s) => <option key={s.id} value={s.id}>{s.name}{s.location ? ` · ${s.location}` : ''}</option>)}
              <option value={NEW}>+ Create a new station on the web</option>
            </select>
          </div>
        </div>
      )}
      {newName !== null && (
        <div>
          <label className={LABEL} htmlFor="link-new-name">New station’s name</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
            <input id="link-new-name" value={newName} onChange={(e) => { setNewName(e.target.value); setError('') }} maxLength={100} className={AUTH_INPUT} required />
          </div>
          <p className="text-xs text-content-faint mt-1">
            Made on the web from this computer’s records, with their setup and opening balances. It has no subscription yet: the records go up once one is running.
          </p>
        </div>
      )}
      {errorBox}
      <button type="submit" disabled={Boolean(busy)} className={submitCls}>
        {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {busy}</> : newName !== null ? 'Create and link' : stations ? 'Link this station' : 'Link this computer'}
      </button>
      {!stations && (
        <button type="button" onClick={() => { setNewName(newName === null ? createFor : null); setError('') }} className="w-full py-2 text-sm text-content-muted">
          {newName === null ? <>No station on the web for this computer yet? <span className="font-semibold text-content">Create one</span></> : 'Link an existing station instead'}
        </button>
      )}
      <p className="text-xs text-content-faint text-center">
        Needs the internet this once. Only the station’s owner can link a computer. After this it works offline; staff sign in here with PINs.
      </p>
    </form>
  )
}
