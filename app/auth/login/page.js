'use client'

import '@/lib/local/installFetch'
import { useState } from 'react'
import Image from 'next/image'
import { Loader2, Lock, Mail, User } from 'lucide-react'
import { LABEL } from '@/components/ui'
import { AUTH_INPUT, AUTH_SUBMIT } from '../authStyles'
import { signIn, signUp } from '@/lib/local/accounts'

/**
 * Desktop sign-in, with the StationMGR web account: the same email and password as the website,
 * no PINs (lib/local/accounts.js). The first sign-in on a computer needs the internet; after
 * that it works offline. A new person creates their account here (online), then adds their
 * stations from Your stations.
 */
export default function LoginPage() {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Into the stations this person may open (screens/dashboard/page.js). A full load: it is an
  // Ionic app of its own.
  const goIn = () => window.location.replace('/dashboard')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (creating && password !== confirm) { setError('The two passwords do not match'); return }
    setBusy(true)
    const result = creating ? await signUp({ name, email, password }) : await signIn({ email, password })
    setBusy(false)
    if (!result.ok) { setError(result.error); setPassword(''); setConfirm(''); return }
    goIn()
  }

  const switchTo = (toCreate) => { setCreating(toCreate); setError(''); setPassword(''); setConfirm('') }
  const field = (id, label, Icon, props) => (
    <div>
      <label className={LABEL} htmlFor={id}>{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
        <input id={id} className={AUTH_INPUT} required {...props} />
      </div>
    </div>
  )

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <Image src="/icon-192.png" alt="StationMGR" width={48} height={48} className="mx-auto mb-3 rounded-lg" />
        <h1 className="text-2xl font-bold text-content">{creating ? 'Create an account' : 'Sign in to StationMGR'}</h1>
        <p className="text-sm text-content-muted mt-1">
          {creating ? 'One account for the website and this computer.' : 'With your StationMGR web account.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {creating && field('name', 'Your name', User, { value: name, onChange: (e) => setName(e.target.value), maxLength: 80, autoFocus: true })}
        {field('email', 'Email', Mail, { type: 'email', autoComplete: 'username', value: email, onChange: (e) => { setEmail(e.target.value); setError('') }, autoFocus: !creating })}
        {field('password', 'Password', Lock, { type: 'password', autoComplete: creating ? 'new-password' : 'current-password', value: password, onChange: (e) => { setPassword(e.target.value); setError('') } })}
        {creating && field('confirm', 'Repeat password', Lock, { type: 'password', autoComplete: 'new-password', value: confirm, onChange: (e) => setConfirm(e.target.value) })}
        {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className={`w-full py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${AUTH_SUBMIT}`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {creating ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button type="button" onClick={() => switchTo(!creating)} className="w-full mt-4 py-2 text-sm text-content-muted">
        {creating ? <>Already have an account? <span className="font-semibold text-content">Sign in</span></> : <>New here? <span className="font-semibold text-content">Create an account</span></>}
      </button>
      <p className="text-xs text-content-faint text-center mt-2">
        The first sign-in on this computer needs the internet. After that it works offline.
        {!creating && ' Forgot your password? Reset it on stationmgr.site.'}
      </p>
    </div>
  )
}
