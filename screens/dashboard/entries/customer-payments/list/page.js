'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import {
  EntryListScreen, EntryListEmpty, DayRows, DayRow, ListPager,
} from '@/components/entries/EntryListParts'
import { ListSkeleton } from '@/components/Skeletons'

export default function CustomerPaymentsListPage() {
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
    () => ready && orgId ? db.customerPayments.where('orgId').equals(orgId).reverse().sortBy('entryDate') : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('customerPayments').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  const customersMap = useLiveQuery(
    () => ready && orgId
      ? db.customers.where('orgId').equals(orgId).toArray().then(arr => Object.fromEntries(arr.map(c => [c.id, c.name])))
      : {},
    [orgId, ready], {}
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
      totalPaid: entries.reduce((s, e) => s + (Number(e.amountPaid) || 0), 0),
      totalSales: entries.reduce((s, e) => s + (Number(e.salesAmount) || 0), 0),
    }))
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (!ready) return <ListSkeleton />


  return (
    <EntryListScreen newHref={`/dashboard/entries/customer-payments?${qs}`}>
      {pageGroups.length === 0 ? (
        <EntryListEmpty />
      ) : (
        <>
          <DayRows>
            {pageGroups.map((group) => (
              <DayRow
                key={group.date}
                href={`/dashboard/entries/customer-payments?${qs}&edit_date=${group.date}`}
                date={group.date}
                count={group.entries.length}
                detail={group.entries.map((e) => `${customersMap[e.customerId] || 'Unknown'} paid ₦${Number(e.amountPaid).toLocaleString()}`).join(' · ')}
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
