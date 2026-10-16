'use client'

import '@/lib/local/installFetch'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, Lock, User, AtSign, Store } from 'lucide-react'
import { LABEL, BTN_FRAMED } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT } from '../authStyles'
import LinkForm from '@/components/desktop/LinkForm'

/**
 * Desktop sign-in.
 *
 *   first run  → the owner names the station and chooses the username and PIN they sign in with
 *                here: no internet, no account, and the free features open at once. Or, with a
 *                StationMGR web account, they link this computer to their station first
 *                (LinkForm), which brings its records down, and then choose their PIN.
 *   afterwards → pick your name, enter your PIN
 */
export default function LoginPage() {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // sign-in
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')

  // first run
  const [linking, setLinking] = useState(false)
  const [stationName, setStationName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [username, setUsername] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  // a linked computer holding another station's records (lib/local/restorePlan.js heldStation)
  const [rescue, setRescue] = useState(false)
  const [notice, setNotice] = useState('')
  // the station on this computer to create (or link) on the web: after restoring another
  // station's backup (?restored=), or chosen at the rescue
  const [linkFor, setLinkFor] = useState(null)

  const loadStatus = () =>
    fetch('/api/local/status')
      .then((r) => r.json())
      .then((s) => {
        setStatus(s)
        if (s.users?.length === 1) setUserId(s.users[0].id)
        if (s.link?.ownerName) setOwnerName((n) => n || s.link.ownerName)
      })
      .catch(() => setError('Could not open the local database.'))

  useEffect(() => {
    loadStatus()
    const restored = new URLSearchParams(window.location.search).get('restored')
    if (restored !== null) setLinkFor(restored)
  }, [])

  // Into the stations this person may open (screens/dashboard/page.js), which opens the one
  // station at once when there is only one. A full load: it is an Ionic app of its own.
  const goIn = () => window.location.replace('/dashboard')

  const signIn = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    const res = await fetch('/api/local/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pin }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(body.error || 'Sign in failed'); setPin(''); return }
    // The linked station is not on this computer: going in would only come back here.
    if (status.heldStation) { setRescue(true); setPin(''); return }
    goIn(status)
  }

  const choose = async (keep, { thenCreate = false } = {}) => {
    const held = status.heldStation.name || 'the other station'
    if (keep === 'web' && !window.confirm(`This removes ${held}'s records from this computer. Keep a backup of them first if you need them. Continue?`)) return
    setBusy(true); setError('')
    const res = await fetch('/api/local/rescue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keep }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(body.error || 'That did not work'); return }
    setRescue(false)
    if (keep === 'web' && !body.pulled) {
      setNotice(`Nothing came down from the web yet${body.error ? ` (${body.error})` : ''}. Choose your PIN, then Pull from the station page once its subscription is running.`)
    }
    const next = await fetch('/api/local/status').then((r) => r.json())
    setStatus(next)
    if (keep === 'held' && thenCreate) setLinkFor(status.heldStation.name || '')
    else if (keep === 'held') goIn(next)
  }

  const setup = async (e) => {
    e.preventDefault()
    setError('')
    if (newPin !== confirmPin) { setError('The two PINs do not match'); return }
    setBusy(true)
    const res = await fetch('/api/local/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationName, ownerName, username, pin: newPin }),
    })
    const body = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(body.error || 'Setup failed'); return }
    // A full load: the station is an Ionic app of its own (components/shell/IonicShell.js).
    window.location.replace(body.onboardingComplete ? `/dashboard/stations/${body.stationId}` : `/dashboard/setup/${body.stationId}`)
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center text-content-muted">
        {error || <Loader2 className="w-5 h-5 animate-spin" />}
      </div>
    )
  }

  const submitCls = `w-full py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${AUTH_SUBMIT}`
  const errorBox = error && (
    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
  )

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
        <h1 className="text-2xl font-bold text-content">
          {status.setupDone ? (status.stationName || 'StationMGR') : status.linked ? status.stationName : linking ? 'Link to your station' : 'Set up StationMGR'}
        </h1>
        <p className="text-sm text-content-muted mt-1">
          {status.setupDone
            ? 'Choose your name and enter your PIN'
            : status.linked
              ? 'Linked. Now choose how you sign in on this computer.'
              : linking
                ? 'Sign in with your StationMGR web account, once. After that it works offline.'
                : 'Name your station and choose how you sign in. No internet needed.'}
        </p>
      </div>

      {notice && <p className="text-sm text-content-muted mb-4" role="status">{notice}</p>}

      {linkFor !== null ? (
        <div className="space-y-4">
          <p className="text-sm text-content">
            <strong>{linkFor || 'This station'}</strong> is on this computer, with its setup and opening balances, and works
            offline now. Create it as a new station on the web, or link it if it is there already, so it can sync once a
            subscription is running.
          </p>
          <LinkForm createFor={linkFor} canBackUp={false} onLinked={() => { setLinkFor(null); window.history.replaceState(null, '', '/auth/login'); loadStatus() }} />
          <button type="button" onClick={() => { setLinkFor(null); window.history.replaceState(null, '', '/auth/login') }} className="w-full py-2 text-sm text-content-muted">
            Not now: work offline
          </button>
        </div>
      ) : rescue ? (
        <div className="space-y-4">
          <p className="text-sm text-content">
            This computer holds the records of <strong>{status.heldStation.name || 'another station'}</strong>, but it is
            linked to <strong>{status.stationName || 'a different station'}</strong>. Choose which to keep.
          </p>
          <button type="button" onClick={() => choose('web')} disabled={busy} className={submitCls}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Get {status.stationName || 'the linked station'} back from the web
          </button>
          <p className="text-xs text-content-faint">
            Removes {status.heldStation.name || 'these'} records from this computer and brings the linked station&apos;s down
            from the web (its subscription must be running). Then you choose your PIN again.
          </p>
          <button type="button" onClick={() => choose('held')} disabled={busy} className={`w-full py-2.5 font-medium disabled:opacity-50 ${BTN_FRAMED}`}>
            Keep {status.heldStation.name || 'these records'} and unlink
          </button>
          <p className="text-xs text-content-faint">
            Keeps these records. This computer stops being linked to {status.stationName || 'the other station'}; you can
            link it to {status.heldStation.name || 'its own station'} later.
          </p>
          <button type="button" onClick={() => choose('held', { thenCreate: true })} disabled={busy} className={`w-full py-2.5 font-medium disabled:opacity-50 ${BTN_FRAMED}`}>
            Create {status.heldStation.name || 'these records'} as a new station on the web
          </button>
          <p className="text-xs text-content-faint">
            Keeps these records, unlinks from {status.stationName || 'the other station'}, and makes a new web station for them
            with their setup and opening balances.
          </p>
          {errorBox}
        </div>
      ) : status.setupDone ? (
        <form onSubmit={signIn} className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="who">Who is signing in?</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
              <select id="who" value={userId} onChange={(e) => { setUserId(e.target.value); setError('') }} className={AUTH_INPUT} required>
                <option value="" disabled>Select your name</option>
                {status.users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.isOwner ? ' (owner)' : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="pin">PIN</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
              <input id="pin" type="password" inputMode="numeric" autoComplete="off" autoFocus
                value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
                maxLength={8} className={AUTH_INPUT} placeholder="••••" required />
            </div>
          </div>
          {errorBox}
          <button type="submit" disabled={busy || !userId || pin.length < 4} className={submitCls}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Sign in
          </button>
          <p className="text-xs text-content-faint text-center">Forgot your PIN? The owner can reset it from the station page.</p>
        </form>
      ) : !status.linked && linking ? (
        <div className="space-y-4">
          <LinkForm onLinked={() => loadStatus()} />
          <button type="button" onClick={() => { setLinking(false); setError('') }} className="w-full py-2 text-sm text-content-muted">
            Back: set up without an account
          </button>
        </div>
      ) : (
        <form onSubmit={setup} className="space-y-4">
          {!status.linked && (
            <div>
              <label className={LABEL} htmlFor="station">Station name</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
                <input id="station" value={stationName} onChange={(e) => setStationName(e.target.value)} maxLength={80} className={AUTH_INPUT} required autoFocus />
              </div>
            </div>
          )}
          <div>
            <label className={LABEL} htmlFor="owner">Your name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
              <input id="owner" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={80} className={AUTH_INPUT} required />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="username">Username</label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
              <input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} maxLength={32} className={AUTH_INPUT} placeholder="e.g. manager" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="newpin">PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
                <input id="newpin" type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} maxLength={8} className={AUTH_INPUT} placeholder="4-8 digits" required />
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="confirmpin">Repeat PIN</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
                <input id="confirmpin" type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} maxLength={8} className={AUTH_INPUT} required />
              </div>
            </div>
          </div>
          {errorBox}
          <button type="submit" disabled={busy || newPin.length < 4} className={submitCls}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save and sign in
          </button>
          {!status.linked && (
            <button type="button" onClick={() => { setLinking(true); setError('') }} className="w-full py-2 text-sm text-content-muted">
              Already have a StationMGR web account? <span className="font-semibold text-content">Link instead</span>
            </button>
          )}
        </form>
      )}
    </div>
  )
}
