'use client'

import { useEffect, useState } from 'react'
import Link, { useRouter } from '@/lib/nav'
import { Loader2, Pencil, Settings, ChevronRight, Trash2 } from 'lucide-react'
import { INPUT, LABEL, BTN_PRIMARY, BTN_DANGER, IconChip } from '@/components/ui'

/**
 * Manage station, at the top of the station's Settings screen and always open (it used to sit
 * folded at the bottom of the station home): setting up a station that is not finished yet,
 * renaming it, and deleting it. The owner's alone, so it shows nothing to staff.
 */
export default function ManageStation({ stationId }) {
  const router = useRouter()
  const [station, setStation] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { ok, text }

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`/api/organizations?org_id=${encodeURIComponent(stationId)}`).then((r) => (r.ok ? r.json() : {})),
      fetch('/api/auth/me').then((r) => (r.ok ? r.json() : {})),
    ]).then(([orgs, me]) => {
      if (!alive) return
      const s = (orgs.stations || [])[0] || null
      setStation(s)
      setName(s?.name || '')
      setIsOwner(!!s && !!me?.user?.id && s.owner_id === me.user.id)
    }).catch(() => {})
    return () => { alive = false }
  }, [stationId])

  const rename = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/organizations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stationId, name }),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) setStation((prev) => ({ ...prev, name: name.trim() }))
    setMessage(res.ok ? { ok: true, text: 'Renamed.' } : { ok: false, text: body.error || `Could not rename (${res.status})` })
    setSaving(false)
  }

  const remove = async () => {
    if (!confirm(`Delete "${station.name}"? All staff, data, and subscriptions for this station will be permanently removed.`)) return
    const res = await fetch('/api/organizations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: stationId }),
    })
    if (res.ok) { router.push('/dashboard'); return }
    const body = await res.json().catch(() => ({}))
    setMessage({ ok: false, text: body.error || `Could not delete (${res.status})` })
  }

  if (!isOwner) return null
  return (
    <section className="mb-4 w-full bg-surface border-card border-line rounded-house p-3">
      <h2 className="text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3">Manage station</h2>

      {!station.onboarding_complete && (
        <Link href={`/dashboard/setup/${stationId}`} className="mb-3 flex items-center gap-3 p-3 bg-subtle rounded-house transition-colors hover:bg-primary-500/10">
          <IconChip icon={Settings} className="w-10 h-10" iconClass="w-5 h-5" />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-content">Set up this station</span>
            <span className="block text-xs text-content-muted">Configure nozzles, tanks and lodgements</span>
          </span>
          <ChevronRight className="w-4 h-4 text-content-faint flex-shrink-0" />
        </Link>
      )}

      <form onSubmit={rename} className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <label htmlFor="station-name" className={LABEL}>Station name</label>
          <input id="station-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={INPUT} />
        </div>
        <button type="submit" disabled={saving || !name.trim() || name.trim() === station.name} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_PRIMARY}`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
          Rename
        </button>
      </form>
      {message && (
        <p className={`mt-2 text-sm ${message.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} role="status">{message.text}</p>
      )}

      <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-content-muted">Permanently delete this station and all its data.</p>
        <button type="button" onClick={remove} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium ${BTN_DANGER}`}>
          <Trash2 className="w-4 h-4" /> Delete station
        </button>
      </div>
    </section>
  )
}
