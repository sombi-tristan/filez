'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, Loader2 } from 'lucide-react'
import { BTN_PRIMARY } from '@/components/ui'

/**
 * Invites: only the station invites waiting for this person, with Accept, as on the dashboard
 * (screens/dashboard/page.js). StationMGR Desktop opens it in the browser, since the computer
 * cannot accept an invite itself, so it is kept on a computer's browser too
 * (lib/platform.js COMPUTER_PATHS), where the rest of the dashboard is not.
 */
export default function InvitesPage() {
  const [invites, setInvites] = useState(null)
  const [accepting, setAccepting] = useState(null)
  const [accepted, setAccepted] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/invites')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => setInvites(data.invites || []))
      .catch((err) => { setInvites([]); setError(`Could not load your invites: ${err.message}`) })
  }, [])

  const acceptInvite = async (inviteId, name) => {
    setAccepting(inviteId)
    setError('')
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_id: inviteId }),
      })
      if (res.ok) {
        setInvites((prev) => prev.filter((i) => i.id !== inviteId))
        setAccepted((prev) => [...prev, name])
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error || `Failed to accept the invite (HTTP ${res.status})`)
      }
    } catch (err) {
      setError(`Failed to accept the invite: ${err.message}`)
    }
    setAccepting(null)
  }

  if (!invites) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <h1 className="text-xl font-bold text-content mb-6 mt-4">Invites</h1>

      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

      {accepted.length > 0 && (
        <p className="text-sm text-green-600 dark:text-green-400 mb-4">
          Accepted: {accepted.join(', ')}. On StationMGR Desktop, sign out and in again to open {accepted.length === 1 ? 'it' : 'them'}.
        </p>
      )}

      {invites.length === 0 ? (
        !error && accepted.length === 0 && <p className="text-sm text-content-muted">No invites waiting for you.</p>
      ) : (
        <div className="space-y-3">
          {invites.map((inv) => (
            <div key={inv.id} className="border-card border-primary-300 dark:border-primary-800 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950/50 dark:to-primary-900/30 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-content">
                    You&apos;ve been invited to join <strong>{inv.organizations?.name}</strong>
                  </p>
                  <p className="text-xs text-content-muted mt-1">
                    Accept to access this station&apos;s reports and data.
                  </p>
                  <button
                    onClick={() => acceptInvite(inv.id, inv.organizations?.name)}
                    disabled={accepting === inv.id}
                    className={`mt-3 flex items-center gap-1 px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${BTN_PRIMARY}`}
                  >
                    {accepting === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
