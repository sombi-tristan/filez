'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/lib/nav'
import { Loader2, Fuel, ChevronRight, Plus } from 'lucide-react'
import { getLink, setCurrentStationId } from '@/lib/local/link'
import { CARD, CARD_HOVER } from '@/components/ui'
import AddStation from '@/components/desktop/AddStation'

/**
 * Desktop build: the stations on this computer that the person signed in may open: the owner
 * sees every station they own, a staff member the stations they were added to. Choosing one makes
 * it the station open now (lib/local/link.js); the sidebar's switcher moves between them. With
 * one station and nothing to add, it opens at once, as a computer with one station always did.
 * The owner adds stations here (components/desktop/AddStation.js).
 */
export default function DashboardPage() {
  const router = useRouter()
  const [stations, setStations] = useState(null)
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
    const all = [...owned, ...(data.memberStations || []).filter((m) => !owned.some((o) => o.id === m.id))]
    setIsOwner(owned.length > 0 || all.length === 0)
    setStations(all)
    setUnowned(data.unownedStations || [])
    return { all, unowned: data.unownedStations || [] }
  }

  useEffect(() => {
    const wantsList = new URLSearchParams(window.location.search).has('all')
    // A station with no owner here is shown, so then the list does not open the one at once.
    load().then(({ all, unowned }) => { if (all.length === 1 && !wantsList && !unowned.length) open(all[0]) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!stations) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-sm font-semibold text-content uppercase tracking-wide">Your stations</h1>
        {isOwner && !adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
            <Plus className="w-4 h-4" /> Add a station
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-6">
          <AddStation onAdded={(station) => { setAdding(false); load(); if (station) open(station) }} onCancel={() => setAdding(false)} />
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

      {stations.length === 0 ? (
        <div className="text-center py-8">
          <Fuel className="w-8 h-8 text-content-faint mx-auto mb-2" />
          <p className="text-sm text-content-muted">No stations on this computer for you yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {stations.map((station) => (
            <button key={station.id} onClick={() => open(station)} className={`w-full text-left flex items-center gap-3 p-3 ${CARD} ${CARD_HOVER}`}>
              <span className="w-10 h-10 flex items-center justify-center flex-shrink-0 bg-primary-500">
                <Fuel className="w-5 h-5 text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-content">{station.name}</span>
                <p className="text-xs text-content-muted">{getLink(station.id) ? 'Linked to the web' : 'On this computer only'}</p>
                {station.onboarding_complete === false && (
                  <p className="text-xs text-orange-600 dark:text-orange-300 font-medium mt-0.5">Setup required</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-content-faint flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
