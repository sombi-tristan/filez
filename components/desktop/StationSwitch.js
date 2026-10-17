'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronRight, Fuel } from 'lucide-react'
import { useRouter } from '@/lib/nav'
import { setCurrentStationId } from '@/lib/local/link'
import { CARD, CARD_HOVER, SectionHeader } from '@/components/ui'

/**
 * Desktop build: moving to another station on this computer, on the station's Settings page
 * (the sidebar's head only names the station open). Lists the stations the person may open,
 * the one open marked, and Your stations for the whole list and adding one.
 */
export default function StationSwitch({ stationId }) {
  const router = useRouter()
  const [stations, setStations] = useState([])

  useEffect(() => {
    fetch('/api/organizations')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const owned = d.stations || []
        setStations([...owned, ...(d.memberStations || []).filter((m) => !owned.some((o) => o.id === m.id))])
      })
  }, [])

  const open = (s) => {
    if (s.id === stationId) return
    setCurrentStationId(s.id)
    router.root(s.onboarding_complete === false ? `/dashboard/setup/${s.id}` : `/dashboard/stations/${s.id}`)
  }

  return (
    <section className="mb-6">
      <SectionHeader>Switch station</SectionHeader>
      <div className="space-y-2">
        {stations.map((s) => (
          <button key={s.id} onClick={() => open(s)} className={`w-full text-left flex items-center gap-3 p-3 ${CARD} ${s.id === stationId ? '' : CARD_HOVER}`} aria-current={s.id === stationId ? 'true' : undefined}>
            <Fuel className="w-4 h-4 text-accent shrink-0" />
            <span className="flex-1 min-w-0 truncate text-sm font-semibold text-content">{s.name}</span>
            {s.id === stationId ? <Check className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-content-faint" />}
          </button>
        ))}
        <button onClick={() => router.root('/dashboard?all=1')} className="text-sm font-medium text-primary-600 hover:text-primary-700">
          Your stations: see all, or add one
        </button>
      </div>
    </section>
  )
}
