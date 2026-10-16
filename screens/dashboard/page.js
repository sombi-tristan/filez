'use client'

import { useState, useEffect } from 'react'
import { useRouter } from '@/lib/nav'
import Link from '@/lib/nav'
import {
  MessageSquare, Loader2,
  Building2, Check, Plus,
  Fuel, ChevronRight, CreditCard, Shield, LogOut
} from 'lucide-react'
import InstallPWABanner from '@/components/InstallPWABanner'
import { supabase } from '@/lib/supabaseClient'
import { INPUT, BTN_PRIMARY, BTN_FRAMED, CARD_HOVER, CARD } from '@/components/ui'

// One uniform card look for every station/link (no per-card colours), matching
// store-portal/app/businesses/page.js. The icon tile is the solid accent square there,
// which is what makes the two pickers read as the same screen.
const CARD_TILE = 'bg-surface'
const CARD_ICON = 'bg-primary-500'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Invites (staff)
  const [invites, setInvites] = useState([])
  const [accepting, setAccepting] = useState(null)
  const [visiblePages, setVisiblePages] = useState(null)

  // Stations (manager + member)
  const [stations, setStations] = useState([])
  const [memberStations, setMemberStations] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const isAdmin = profile?.role === 'admin'

  const loadInvites = async () => {
    const res = await fetch('/api/invites')
    if (res.ok) {
      const data = await res.json()
      setInvites(data.invites || [])
      if (data.visiblePages) setVisiblePages(data.visiblePages)
    }
  }

  const loadStations = async () => {
    const res = await fetch('/api/organizations')
    if (res.ok) {
      const data = await res.json()
      setStations(data.stations || [])
      setMemberStations(data.memberStations || [])
    }
  }

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dashboard/data')
      if (!res.ok) return
      const data = await res.json()
      setProfile(data.profile)
      setLoading(false)
      if (data.profile?.role !== 'admin') {
        loadInvites()
        loadStations()
      }
    }
    load()
  }, [])

  // Staff actions
  const acceptInvite = async (inviteId) => {
    setAccepting(inviteId)
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invite_id: inviteId }),
    })
    if (res.ok) {
      const r = await fetch('/api/dashboard/data')
      if (r.ok) { const d = await r.json(); setProfile(d.profile) }
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
    } else {
      const err = await res.json()
      alert(err.error || 'Failed to accept invite')
    }
    setAccepting(null)
  }

  // Manager actions
  const addStation = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    })
    if (res.ok) {
      setNewName('')
      setShowAdd(false)
      loadStations()
    }
    setAdding(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  // Admin — redirect to admin panel
  if (isAdmin) {
    router.push('/admin')
    return null
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <InstallPWABanner />

      <h1 className="text-xl font-bold text-content mb-1 mt-4">Welcome, {profile?.name}</h1>
      <p className="text-sm text-content-muted mb-8">{profile?.email}</p>

      {/* Pending station invites (staff) */}
      {invites.length > 0 && (
        <div className="mb-8 space-y-3">
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
                    onClick={() => acceptInvite(inv.id)}
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

      {/* My Stations */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-content uppercase tracking-wide">My Stations</h2>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus className="w-4 h-4" /> Add station
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addStation} className={`p-4 mb-4 space-y-3 ${CARD}`}>
            <input
              type="text"
              required
              maxLength={100}
              placeholder="Station name (e.g. MRS Lekki Phase 1)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={INPUT}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={adding}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_PRIMARY}`}
              >
                {adding && <Loader2 className="w-4 h-4 animate-spin" />}
                Create station
              </button>
              <button type="button" onClick={() => { setShowAdd(false); setNewName('') }} className={`px-4 py-2 text-sm ${BTN_FRAMED}`}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {stations.length === 0 && !showAdd ? (
          <div className="text-center py-8">
            <Fuel className="w-8 h-8 text-content-faint mx-auto mb-2" />
            <p className="text-sm text-content-muted">No stations yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {stations.map((station) => (
              <Link key={station.id} href={`/dashboard/stations/${station.id}`} className={`flex items-center gap-3 p-3 ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
                <span className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${CARD_ICON}`}>
                  <Fuel className="w-5 h-5 text-white" />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-content">{station.name}</span>
                  {station.location && <p className="text-xs text-content-muted">{station.location}</p>}
                  {!station.onboarding_complete && (
                    <p className="text-xs text-orange-600 dark:text-orange-300 font-medium mt-0.5">Setup required</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-content-faint flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Member Stations (joined via invite) */}
      {memberStations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-3">Stations I&apos;ve Joined</h2>
          <div className="space-y-2.5">
            {memberStations.map((station) => (
              <Link key={station.id} href={`/dashboard/stations/${station.id}`} className={`flex items-center gap-3 p-3 ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
                <span className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${CARD_ICON}`}>
                  <Fuel className="w-5 h-5 text-white" />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-content">{station.name}</span>
                  {station.location && <p className="text-xs text-content-muted">{station.location}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-content-faint flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Inline bordered cards with an accent chip, the shape store-portal's "Send feedback"
          card uses. Subscribe has no store-portal counterpart at this level but is a real
          station destination, so it keeps its place beside Feedback. */}
      <section className="mb-8 flex flex-wrap gap-2.5">
        <Link href="/dashboard/subscribe" className={`inline-flex items-center gap-2 p-3 text-sm font-medium text-content-strong ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
          <span className={`w-8 h-8 flex items-center justify-center ${CARD_ICON}`}><CreditCard className="w-4 h-4 text-white" /></span>
          Subscribe
        </Link>
        <Link href="/dashboard/feedback" className={`inline-flex items-center gap-2 p-3 text-sm font-medium text-content-strong ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
          <span className={`w-8 h-8 flex items-center justify-center ${CARD_ICON}`}><MessageSquare className="w-4 h-4 text-white" /></span>
          Help &amp; feedback
        </Link>
        {isAdmin && (
          <Link href="/admin" className={`inline-flex items-center gap-2 p-3 text-sm font-medium text-content-strong ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
            <span className={`w-8 h-8 flex items-center justify-center ${CARD_ICON}`}><Shield className="w-4 h-4 text-white" /></span>
            Admin
          </Link>
        )}
      </section>

      {/* Sign out */}
      <button
        onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
        className={`flex items-center gap-2 px-4 py-2 text-sm ${BTN_FRAMED}`}
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  )
}
