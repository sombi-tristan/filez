'use client'

import '@/lib/local/installFetch'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Lock, User, Store, AtSign } from 'lucide-react'
import { LABEL } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT } from '../authStyles'

/**
 * Desktop sign-in. Two modes:
 *   first run  → create the station and the owner (name, username, PIN), then go to setup
 *   afterwards → pick your name, enter your PIN
 */
export default function LoginPage() {
  const router = useRouter()
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // sign-in
  const [userId, setUserId] = useState('')
  const [pin, setPin] = useState('')

  // first run
  const [stationName, setStationName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [username, setUsername] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  useEffect(() => {
    fetch('/api/local/status')
      .then((r) => r.json())
      .then((s) => {
        setStatus(s)
        if (s.users?.length === 1) setUserId(s.users[0].id)
      })
      .catch(() => setError('Could not open the local database.'))
  }, [])

  const goIn = (s) => {
    router.replace(s?.onboardingComplete === false
      ? `/dashboard/setup/${s.stationId}`
      : `/dashboard/stations/${s.stationId}`)
  }

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
    goIn(status)
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
    router.replace(`/dashboard/setup/${body.stationId}`)
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
          {status.setupDone ? (status.stationName || 'StationMGR') : 'Set up StationMGR'}
        </h1>
        <p className="text-sm text-content-muted mt-1">
          {status.setupDone
            ? 'Choose your name and enter your PIN'
            : 'Everything is stored on this computer. No internet needed.'}
        </p>
      </div>

      {status.setupDone ? (
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
      ) : (
        <form onSubmit={setup} className="space-y-4">
          <div>
            <label className={LABEL} htmlFor="station">Station name</label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
              <input id="station" value={stationName} onChange={(e) => setStationName(e.target.value)} maxLength={100} className={AUTH_INPUT} placeholder="e.g. Rainoil Wuse" required />
            </div>
          </div>
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
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Create station
          </button>
        </form>
      )}
    </div>
  )
}
