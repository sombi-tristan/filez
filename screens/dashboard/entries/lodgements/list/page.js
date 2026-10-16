'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Spinner } from '@/design'
import {
  EntryListScreen, EntryListEmpty, DayRows, DayRow, ListPager,
} from '@/components/entries/EntryListParts'

export default function LodgementsListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [page, setPage] = useState(1)
  const [ready, setReady] = useState(false)
  const limit = 10
  const typeLabel = { deposit: 'Deposit', 'lube-deposit': 'Lube Deposit', pos: 'POS' }

  useEffect(() => {
    setReady(true)
  }, [orgId])

  const allEntries = useLiveQuery(
    () => ready && orgId ? db.lodgements.where('orgId').equals(orgId).reverse().sortBy('entryDate') : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('lodgements').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      const date = entry.entryDate || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => ({
      date,
      entries,
      totalAmount: entries.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    }))
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (!ready) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <EntryListScreen newHref={`/dashboard/entries/lodgements?${qs}`}>
      {pageGroups.length === 0 ? (
        <EntryListEmpty />
      ) : (
        <>
          <DayRows>
            {pageGroups.map((group) => (
              <DayRow
                key={group.date}
                href={`/dashboard/entries/lodgements?${qs}&edit_date=${group.date}`}
                date={group.date}
                count={group.entries.length}
                amount={`₦${group.totalAmount.toLocaleString()}`}
                detail={(() => {
                  const counts = {}
                  for (const e of group.entries) {
                    const t = e.lodgementType || 'unknown'
                    counts[t] = (counts[t] || 0) + 1
                  }
                  return Object.entries(counts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([t, c]) => `${c} ${typeLabel[t] || t}`)
                    .join(' · ')
                })()}
                pending={group.entries.some(e => pendingIds.has(e.id))}
              />
            ))}
          </DayRows>
          <ListPager page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </EntryListScreen>
  )
}
