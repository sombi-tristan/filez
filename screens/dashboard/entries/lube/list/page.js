'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { Tabs } from '@/design'
import { isReceipt } from '@/lib/lubeEntries'
import {
  EntryListScreen, EntryListEmpty, DayRows, DayRow, ListPager, SubscribeNotice,
} from '@/components/entries/EntryListParts'

export default function LubeListPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const qs = `org_id=${orgId}`
  const [tab, setTab] = useState('sales')
  const [ready, setReady] = useState(false)
  const { subscribed, loading: subLoading } = useSubscription(orgId, 'lube-management')

  useEffect(() => {
    setReady(true)
  }, [orgId])

  if (!ready) return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-line border-t-blue-600 rounded-full animate-spin" /></div>

  return (
    <EntryListScreen
      newHref={`/dashboard/entries/lube?${qs}&type=${tab}`}
      newDisabled={!subLoading && !subscribed}
      top={(
        <>
          {!subLoading && !subscribed && <SubscribeNotice />}
          <div className="mb-4 border-b border-line">
            <Tabs
              label="Lube entries"
              items={[{ id: 'sales', label: 'Lube sales' }, { id: 'receipt', label: 'Lube receipt' }, { id: 'stock', label: 'Lube stock' }]}
              value={tab}
              onChange={setTab}
            />
          </div>
        </>
      )}
    >
      {/* The tab's own title. */}
      <h2 className="text-base font-bold text-content mb-3">{{ sales: 'Lube sales', receipt: 'Lube receipt', stock: 'Lube stock' }[tab]}</h2>
      {tab === 'stock'
        ? <LubeStockList orgId={orgId} qs={qs} ready={ready} />
        : <LubeSalesList key={tab} orgId={orgId} qs={qs} ready={ready} receipt={tab === 'receipt'} />}
    </EntryListScreen>
  )
}

/** The lube sales, or with `receipt` the lube receipts (lib/lubeEntries.js isReceipt), by day. */
function LubeSalesList({ orgId, qs, ready, receipt = false }) {
  const [page, setPage] = useState(1)
  const limit = 10

  const allEntries = useLiveQuery(
    () => ready && orgId ? db.lubeSales.where('orgId').equals(orgId).reverse().sortBy('entryDate') : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('lubeSales').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  const productsMap = useLiveQuery(
    () => ready && orgId
      ? db.lubeProducts.where('orgId').equals(orgId).toArray().then(arr => Object.fromEntries(arr.map(p => [p.id, p.product_name])))
      : {},
    [orgId, ready], {}
  )

  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      if (isReceipt(entry) !== receipt) continue
      const date = entry.entryDate || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => ({ date, entries }))
  }, [allEntries, receipt])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (pageGroups.length === 0) return <EntryListEmpty what={receipt ? 'lube receipts' : 'sales entries'} />

  return (
    <>
      <DayRows>
        {pageGroups.map((group) => (
          <DayRow
            key={group.date}
            href={`/dashboard/entries/lube?${qs}&type=${receipt ? 'receipt' : 'sales'}&edit_date=${group.date}`}
            date={group.date}
            count={group.entries.length}
            detail={group.entries.map((e) => (receipt
              ? `${productsMap[e.productId] || 'Unknown'}: ${e.unitReceived} received${e.invoiceNo ? ` (inv. ${e.invoiceNo})` : ''}`
              : `${productsMap[e.productId] || 'Unknown'}: ${e.unitSold} sold, ${e.unitReceived} received`)).join(' · ')}
            pending={group.entries.some(e => pendingIds.has(e.id))}
          />
        ))}
      </DayRows>
      <ListPager page={page} totalPages={totalPages} onPage={setPage} />
    </>
  )
}

function LubeStockList({ orgId, qs, ready }) {
  const [page, setPage] = useState(1)
  const limit = 10

  const allEntries = useLiveQuery(
    () => ready && orgId ? db.lubeStock.where('orgId').equals(orgId).reverse().sortBy('entryDate') : [],
    [orgId, ready], []
  )

  const pendingIds = useLiveQuery(
    () => ready
      ? db.syncQueue.where('table').equals('lubeStock').toArray().then(items =>
          new Set(items.filter(i => i.operation !== 'DELETE').map(i => i.payload?.id).filter(Boolean))
        )
      : new Set(),
    [ready], new Set()
  )

  const productsMap = useLiveQuery(
    () => ready && orgId
      ? db.lubeProducts.where('orgId').equals(orgId).toArray().then(arr => Object.fromEntries(arr.map(p => [p.id, p.product_name])))
      : {},
    [orgId, ready], {}
  )

  const groupedEntries = useMemo(() => {
    const groups = {}
    for (const entry of allEntries) {
      const date = entry.entryDate || 'no-date'
      if (!groups[date]) groups[date] = []
      groups[date].push(entry)
    }
    return Object.entries(groups).map(([date, entries]) => ({ date, entries }))
  }, [allEntries])

  const total = groupedEntries.length
  const totalPages = Math.ceil(total / limit)
  const pageGroups = groupedEntries.slice((page - 1) * limit, page * limit)

  if (pageGroups.length === 0) return <EntryListEmpty what="stock entries" />

  return (
    <>
      <DayRows>
        {pageGroups.map((group) => (
          <DayRow
            key={group.date}
            href={`/dashboard/entries/lube?${qs}&type=stock&edit_date=${group.date}`}
            date={group.date}
            count={group.entries.length}
            detail={group.entries.map((e) => `${productsMap[e.productId] || 'Unknown'}: ${Number(e.stock).toLocaleString()} in stock`).join(' · ')}
            pending={group.entries.some(e => pendingIds.has(e.id))}
          />
        ))}
      </DayRows>
      <ListPager page={page} totalPages={totalPages} onPage={setPage} />
    </>
  )
}
