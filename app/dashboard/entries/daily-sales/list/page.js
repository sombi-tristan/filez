'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { Spinner } from '@/design'
import {
  EntryListScreen, EntryListEmpty, DayRows, DayRow, ListPager,
} from '@/components/entries/EntryListParts'

export default function DailySalesListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [page, setPage] = useState(1)
  const [ready, setReady] = useState(false)
  const limit = 10

  useEffect(() => {
    setReady(true)
  }, [orgId])

  const allEntries = useLiveQuery(
    () => ready && orgId
      ? db.dailySales.where('orgId').equals(orgId).reverse().sortBy('entryDate')
      : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('dailySales').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      const date = entry.entryDate || entry.entry_date || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => ({ date, entries }))
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (!ready) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <EntryListScreen newHref={`/dashboard/entries/daily-sales?${qs}`}>
      {pageGroups.length === 0 ? (
        <EntryListEmpty />
      ) : (
        <>
          <DayRows>
            {pageGroups.map((group) => (
              <DayRow
                key={group.date}
                href={`/dashboard/entries/daily-sales?${qs}&edit_date=${group.date}`}
                date={group.date}
                count={group.entries.length}
                detail={(() => {
                  const prices = group.entries[0]?.prices || {}
                  const parts = ['PMS', 'AGO', 'DPK'].filter((f) => prices[f]).map((f) => `${f} ₦${Number(prices[f]).toLocaleString()}`)
                  if (group.entries.some(e => e.closeOfBusiness || e.close_of_business)) parts.push('Closed (COB)')
                  return parts.join(' · ')
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
