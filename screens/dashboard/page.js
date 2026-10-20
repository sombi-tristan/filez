'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/lib/nav'
import { Loader2, Fuel, ChevronRight, Plus, CreditCard, MessageSquare, LogOut, Building2, ExternalLink } from 'lucide-react'
import { getLink, setCurrentStationId } from '@/lib/local/link'
import { openWeb } from '@/lib/local/web'
import { myPendingInvites } from '@/lib/local/accounts'
import { supabase } from '@/lib/supabaseClient'
import { CARD, CARD_HOVER, BTN_FRAMED, BTN_PRIMARY } from '@/components/ui'
import AddStation from '@/components/desktop/AddStation'

// The web's card look (screens/dashboard/page.js on main): the solid accent square for the icon.
const CARD_TILE = 'bg-surface'
const CARD_ICON = 'bg-primary-500'

/** One station on the list: its name, address, whether it is linked, and Setup required. */
function StationCard({ station, onOpen }) {
  return (
    <button onClick={() => onOpen(station)} className={`w-full text-left flex items-center gap-3 p-3 ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
      <span className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${CARD_ICON}`}>
        <Fuel className="w-5 h-5 text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-content">{station.name}</span>
        {station.location && <p className="text-xs text-content-muted">{station.location}</p>}
        <p className="text-xs text-content-muted">{getLink(station.id) ? 'Linked to the web' : 'On this computer only'}</p>
        {station.onboarding_complete === false && (
          <p className="text-xs text-orange-600 dark:text-orange-300 font-medium mt-0.5">Setup required</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-content-faint flex-shrink-0" />
    </button>
  )
}

/**
 * Desktop build: Your stations, laid out as the web's (screens/dashboard/page.js on main): a
 * welcome, My Stations (owned) and Stations I've Joined (staff), Subscribe and Help & feedback
 * (pages of the web, opened in the browser), and Sign out. Choosing a station makes it the
 * station open now (lib/local/link.js); the sidebar's switcher moves between them. With one
 * station and nothing to add, it opens at once, as a computer with one station always did.
 * Anyone signed in adds stations here, as on the web (components/desktop/AddStation.js).
 */
export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [invites, setInvites] = useState([])
  const [stations, setStations] = useState(null)
  const [memberStations, setMemberStations] = useState([])
  const [unowned, setUnowned] = useState([])
  const [isOwner, setIsOwner] = useState(false)
  const [adding, setAdding] = useState(false)

  const open = (station) => {
    setCurrentStationId(station.id)
    router.replace(station.onboarding_complete === false ? `/dashboard/setup/${station.id}` : `/dashboard/stations/${station.id}`)
  }

  const claim = async (station) => {
    const res = await fetch('/api/local/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim: station.id }) })
    if (res.ok) open(station)
  }

  const load = async () => {
    const res = await fetch('/api/organizations')
    const data = res.ok ? await res.json() : {}
    const owned = data.stations || []
    const joined = (data.memberStations || []).filter((m) => !owned.some((o) => o.id === m.id))
    setIsOwner(owned.length > 0 || joined.length === 0)
    setStations(owned)
    setMemberStations(joined)
    setUnowned(data.unownedStations || [])
    return { all: [...owned, ...joined], unowned: data.unownedStations || [] }
  }

  useEffect(() => {
    fetch('/api/dashboard/data')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => setProfile(d.profile || null))
    myPendingInvites().then(setInvites)
    const wantsList = new URLSearchParams(window.location.search).has('all')
    // A station with no owner here is shown, so then the list does not open the one at once.
    load().then(({ all, unowned }) => { if (all.length === 1 && !wantsList && !unowned.length) open(all[0]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.replace('/auth/login')
  }

  if (!stations) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <h1 className="text-xl font-bold text-content mb-1 mt-4">Welcome, {profile?.name}</h1>
      <p className="text-sm text-content-muted mb-8">{profile?.email}</p>

      {/* Pending station invites (staff), as on the web. The computer cannot accept one: Accept
          opens the web's Invites page, where it is accepted, and the station comes down here at
          the next sign-in. The list is as of the last sign-in. */}
      {invites.length > 0 && (
        <div className="mb-8 space-y-3">
          {invites.map((inv) => (
            <div key={inv.id} className="border-card border-primary-300 dark:border-primary-800 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-950/50 dark:to-primary-900/30 p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-primary-600 dark:text-primary-300 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-content">
                    You&apos;ve been invited to join <strong>{inv.stationName}</strong>
                  </p>
                  {inv.location && <p className="text-xs text-content-muted mt-0.5">{inv.location}</p>}
                  <p className="text-xs text-content-muted mt-1">
                    Accept it on the web, then sign out and in again here to open the station.
                  </p>
                  <button
                    onClick={() => openWeb('/dashboard/invites')}
                    className={`mt-3 flex items-center gap-1 px-3 py-1.5 text-sm font-medium ${BTN_PRIMARY}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Accept on the web
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOwner && unowned.length > 0 && (
        <div className="mb-6 space-y-2">
          <h2 className="text-sm font-semibold text-content">Stations with no owner here</h2>
          <p className="text-xs text-content-muted">These came down from the web, but their owner is not a person on this computer. Take one over to open it, with its records.</p>
          {unowned.map((s) => (
            <div key={s.id} className={`flex items-center justify-between gap-3 p-3 ${CARD}`}>
              <span className="text-sm font-semibold text-content">{s.name || 'Station'}</span>
              <button onClick={() => claim(s)} className="text-sm font-medium text-primary-600 hover:text-primary-700">Make me its owner</button>
            </div>
          ))}
        </div>
      )}

      {/* My Stations */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-content uppercase tracking-wide">My Stations</h2>
          {!adding && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
              <Plus className="w-4 h-4" /> Add a station
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-4">
            <AddStation onAdded={(station) => { setAdding(false); load(); if (station) open(station) }} onCancel={() => setAdding(false)} />
          </div>
        )}

        {stations.length === 0 && !adding ? (
          <div className="text-center py-8">
            <Fuel className="w-8 h-8 text-content-faint mx-auto mb-2" />
            <p className="text-sm text-content-muted">No stations yet. Add one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {stations.map((station) => <StationCard key={station.id} station={station} onOpen={open} />)}
          </div>
        )}
      </section>

      {/* Member Stations (joined via invite) */}
      {memberStations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-3">Stations I&apos;ve Joined</h2>
          <div className="space-y-2.5">
            {memberStations.map((station) => <StationCard key={station.id} station={station} onOpen={open} />)}
          </div>
        </section>
      )}

      {/* The web's Subscribe and Help & feedback cards. The desktop has neither screen, so they
          open the web's pages in the browser. */}
      <section className="mb-8 flex flex-wrap gap-2.5">
        <button onClick={() => openWeb('/dashboard/subscribe')} className={`inline-flex items-center gap-2 p-3 text-sm font-medium text-content-strong ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
          <span className={`w-8 h-8 flex items-center justify-center ${CARD_ICON}`}><CreditCard className="w-4 h-4 text-white" /></span>
          Subscribe
        </button>
        <button onClick={() => openWeb('/dashboard/feedback')} className={`inline-flex items-center gap-2 p-3 text-sm font-medium text-content-strong ${CARD} ${CARD_HOVER} ${CARD_TILE}`}>
          <span className={`w-8 h-8 flex items-center justify-center ${CARD_ICON}`}><MessageSquare className="w-4 h-4 text-white" /></span>
          Help &amp; feedback
        </button>
      </section>

      <button onClick={signOut} className={`flex items-center gap-2 px-4 py-2 text-sm ${BTN_FRAMED}`}>
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  )
}
