'use client'

import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from '@/lib/nav'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { lubeSalesRepo } from '@/lib/repositories/lubeSales'
import { lubeStockRepo } from '@/lib/repositories/lubeStock'
import SearchableSelect from '@/components/SearchableSelect'
import { useSavePush } from '@/components/SavePushProvider'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, ENTRY_SELECT } from '@/components/ui'
import { Tabs } from '@/design'
import {
  EntryScreen, DayBar, EntryCard, Field, FieldRow, NumberInput, SubscribeNotice,
  SaveBar, EntryLoading, NotConfigured, adjacentDates,
} from '@/components/entries/EntryParts'
import { EntryWithDayList, DayEntries } from '@/components/entries/DayEntries'

function blankSalesEntry() {
  return { _key: crypto.randomUUID(), id: null, productId: '', unitSold: '', unitReceived: '', price: '', notes: '' }
}

function blankStockEntry() {
  return { _key: crypto.randomUUID(), id: null, productId: '', stock: '', notes: '' }
}

function salesToForm(e) {
  return {
    _key: e.id, id: e.id,
    productId: e.productId || '',
    unitSold: String(e.unitSold ?? ''),
    unitReceived: String(e.unitReceived ?? ''),
    price: String(e.price ?? ''),
    notes: e.notes || '',
  }
}

function stockToForm(e) {
  return {
    _key: e.id, id: e.id,
    productId: e.productId || '',
    stock: String(e.stock ?? ''),
    notes: e.notes || '',
  }
}

/** The day's saved entries of one table, oldest first, and the days that have any. */
function useDay(table, orgId, formDate) {
  const dayEntries = useLiveQuery(
    () => (orgId && formDate
      ? table.where('orgId').equals(orgId).filter((e) => e.entryDate === formDate).toArray().then((r) => r.sort(byCreatedAt))
      : []),
    [orgId, formDate], []
  )
  const savedDates = useLiveQuery(
    () => (orgId ? table.where('orgId').equals(orgId).toArray().then((all) => [...new Set(all.map((e) => e.entryDate).filter(Boolean))].sort()) : []),
    [orgId], []
  )
  return { dayEntries: dayEntries || [], savedDates: savedDates || [] }
}

export default function LubeFormPage() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const editType = searchParams.get('type') || 'sales'
  const qs = `org_id=${orgId}`

  const [tab, setTab] = useState(editType)
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'lube-management')
  const subBlocked = !subLoading && !isSubscribed
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    const load = async () => {
      const prods = await db.lubeProducts.where('orgId').equals(orgId).toArray()
      if (prods.length === 0) setLocked(true)
      setProducts(prods)
      setLoading(false)
    }
    load()
  }, [orgId, tab])

  if (loading) return <EntryLoading />

  if (locked) return <NotConfigured orgId={orgId} />

  const formProps = { products, qs, orgId, editId, editDate, subBlocked }

  return (
    <EntryScreen wide>
      {!editId && !editDate && (
        <div className="mb-2 border-b border-line">
          <Tabs
            label="Lube entry"
            items={[{ id: 'sales', label: 'Lube sales' }, { id: 'stock', label: 'Lube stock' }]}
            value={tab}
            onChange={setTab}
          />
        </div>
      )}

      {subBlocked && <SubscribeNotice />}

      {/* The tab's own title, also when editing an entry hides the tabs. */}
      <h2 className="text-base font-bold text-content mb-3">{tab === 'sales' ? 'Lube sales' : 'Lube stock'}</h2>

      {tab === 'sales'
        ? <LubeSalesForm {...formProps} />
        : <LubeStockForm {...formProps} />
      }
    </EntryScreen>
  )
}

function LubeSalesForm({ products, qs, orgId, editId, editDate, subBlocked }) {
  const { promptPush } = useSavePush()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankSalesEntry()])
  const [originalIds, setOriginalIds] = useState([])

  const isEditing = originalIds.length > 0
  const clearForm = () => { setOriginalIds([]); setEntries([blankSalesEntry()]) }
  const { dayEntries, savedDates } = useDay(db.lubeSales, orgId, formDate)

  useEffect(() => {
    const load = async () => {
      if (editId) {
        const entry = await lubeSalesRepo.getById(editId)
        if (entry) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([salesToForm(entry)])
        }
      } else if (editDate) {
        // A day opened from the list or the arrows: an empty form, its entries listed beside it.
        setFormDate(editDate)
        setOriginalIds([])
        setEntries([blankSalesEntry()])
      }
      setLoading(false)
    }
    load()
  }, [editId, editDate, orgId])

  // Another day: an empty form, and that day's entries in the list.
  const handleDateChange = (newDate) => {
    setFormDate(newDate)
    clearForm()
  }

  const editEntry = (item) => {
    const entry = dayEntries.find((e) => e.id === item.id)
    if (!entry) return
    setOriginalIds([entry.id])
    setEntries([salesToForm(entry)])
    setError('')
  }

  const deleteEntry = async (item) => {
    await lubeSalesRepo.remove(item.id, orgId)
    if (originalIds.includes(item.id)) clearForm()
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError('Product is required'); submittingRef.current = false; return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const nowMs = Date.now()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await lubeSalesRepo.remove(id, orgId)
        }
      }

      for (const [i, entry] of entries.entries()) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          productId: entry.productId,
          unitSold: Number(entry.unitSold) || 0,
          unitReceived: Number(entry.unitReceived) || 0,
          price: Number(entry.price) || 0,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await lubeSalesRepo.getById(entry.id)
          await lubeSalesRepo.update({ ...existing, ...record })
        } else {
          // Distinct, increasing createdAt by position so the day's entries keep their order
          // when it is reopened (the list sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await lubeSalesRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush()
      // Ready for the next entry: the one saved is in the day's list.
      clearForm()
      setTimeout(() => { setSaved(false); submittingRef.current = false }, 1200)
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <EntryLoading />

  const { prev: prevDate, next: nextDate } = adjacentDates(savedDates, formDate)
  const dayHref = (d) => d && `/dashboard/entries/lube?${qs}&edit_date=${d}&type=sales`
  const productName = (id) => products.find((p) => p.id === id)?.product_name || 'No product'
  const listItems = dayEntries.map((e) => ({
    id: e.id,
    primary: productName(e.productId),
    secondary: `Sold ${Number(e.unitSold || 0).toLocaleString()} · Received ${Number(e.unitReceived || 0).toLocaleString()} · ₦${Number(e.price || 0).toLocaleString()}`,
  }))

  return (
    <EntryWithDayList list={<DayEntries title="Lube sales this day" items={listItems} editingId={originalIds[0]} onEdit={editEntry} onDelete={deleteEntry} />}>
    <form onSubmit={handleSubmit}>
      <DayBar label="Entry date" value={formDate} onChange={handleDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

      {entries.map((entry, idx) => (
        <EntryCard key={entry._key} title={isEditing ? 'Editing entry' : 'New entry'}>
          <Field label="Product">
            <SearchableSelect
              value={entry.productId}
              onChange={(val) => updateEntry(idx, 'productId', val)}
              options={products.map((p) => ({ value: p.id, label: p.product_name }))}
              placeholder="Select product"
              className={ENTRY_SELECT}
            />
          </Field>
          <FieldRow cols={3} keep>
            <Field label="Units sold">
              <NumberInput value={entry.unitSold} onValue={(v) => updateEntry(idx, 'unitSold', v)} placeholder="0" />
            </Field>
            <Field label="Units received">
              <NumberInput value={entry.unitReceived} onValue={(v) => updateEntry(idx, 'unitReceived', v)} placeholder="0" />
            </Field>
            <Field label="Price (₦)">
              <NumberInput value={entry.price} onValue={(v) => updateEntry(idx, 'price', v)} placeholder="0.00" />
            </Field>
          </FieldRow>
          <Field label="Notes">
            <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
          </Field>
        </EntryCard>
      ))}

      {isEditing && (
        <button type="button" onClick={clearForm} className="mb-2 text-sm font-medium text-content-muted hover:text-content">
          Cancel editing
        </button>
      )}

      <SaveBar
        listHref={`/dashboard/entries/lube/list?${qs}`}
        saving={saving}
        saved={saved}
        isEditing={isEditing}
        disabled={subBlocked}
        error={error}
        onErrorDone={() => setError('')}
      />
    </form>
    </EntryWithDayList>
  )
}

function LubeStockForm({ products, qs, orgId, editId, editDate, subBlocked }) {
  const { promptPush } = useSavePush()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankStockEntry()])
  const [originalIds, setOriginalIds] = useState([])

  const isEditing = originalIds.length > 0
  const clearForm = () => { setOriginalIds([]); setEntries([blankStockEntry()]) }
  const { dayEntries, savedDates } = useDay(db.lubeStock, orgId, formDate)

  useEffect(() => {
    const load = async () => {
      if (editId) {
        const entry = await lubeStockRepo.getById(editId)
        if (entry) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([stockToForm(entry)])
        }
      } else if (editDate) {
        // A day opened from the list or the arrows: an empty form, its entries listed beside it.
        setFormDate(editDate)
        setOriginalIds([])
        setEntries([blankStockEntry()])
      }
      setLoading(false)
    }
    load()
  }, [editId, editDate, orgId])

  // Another day: an empty form, and that day's entries in the list.
  const handleStockDateChange = (newDate) => {
    setFormDate(newDate)
    clearForm()
  }

  const editEntry = (item) => {
    const entry = dayEntries.find((e) => e.id === item.id)
    if (!entry) return
    setOriginalIds([entry.id])
    setEntries([stockToForm(entry)])
    setError('')
  }

  const deleteEntry = async (item) => {
    await lubeStockRepo.remove(item.id, orgId)
    if (originalIds.includes(item.id)) clearForm()
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError('Product is required'); submittingRef.current = false; return }
    }
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const nowMs = Date.now()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await lubeStockRepo.remove(id, orgId)
        }
      }

      for (const [i, entry] of entries.entries()) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          productId: entry.productId,
          stock: Number(entry.stock) || 0,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await lubeStockRepo.getById(entry.id)
          await lubeStockRepo.update({ ...existing, ...record })
        } else {
          // Distinct, increasing createdAt by position so the day's entries keep their order
          // when it is reopened (the list sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await lubeStockRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush()
      // Ready for the next entry: the one saved is in the day's list.
      clearForm()
      setTimeout(() => { setSaved(false); submittingRef.current = false }, 1200)
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <EntryLoading />

  const { prev: prevDate, next: nextDate } = adjacentDates(savedDates, formDate)
  const dayHref = (d) => d && `/dashboard/entries/lube?${qs}&edit_date=${d}&type=stock`
  const productName = (id) => products.find((p) => p.id === id)?.product_name || 'No product'
  const listItems = dayEntries.map((e) => ({ id: e.id, primary: productName(e.productId), secondary: `Stock ${Number(e.stock || 0).toLocaleString()} units` }))

  return (
    <EntryWithDayList list={<DayEntries title="Lube stock this day" items={listItems} editingId={originalIds[0]} onEdit={editEntry} onDelete={deleteEntry} />}>
    <form onSubmit={handleSubmit}>
      <DayBar label="Entry date" value={formDate} onChange={handleStockDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

      {entries.map((entry, idx) => (
        <EntryCard key={entry._key} title={isEditing ? 'Editing entry' : 'New entry'}>
          <Field label="Product">
            <SearchableSelect
              value={entry.productId}
              onChange={(val) => updateEntry(idx, 'productId', val)}
              options={products.map((p) => ({ value: p.id, label: p.product_name }))}
              placeholder="Select product"
              className={ENTRY_SELECT}
            />
          </Field>
          <Field label="Stock (units)">
            <NumberInput value={entry.stock} onValue={(v) => updateEntry(idx, 'stock', v)} placeholder="0" />
          </Field>
          <Field label="Notes">
            <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
          </Field>
        </EntryCard>
      ))}

      {isEditing && (
        <button type="button" onClick={clearForm} className="mb-2 text-sm font-medium text-content-muted hover:text-content">
          Cancel editing
        </button>
      )}

      <SaveBar
        listHref={`/dashboard/entries/lube/list?${qs}`}
        saving={saving}
        saved={saved}
        isEditing={isEditing}
        disabled={subBlocked}
        error={error}
        onErrorDone={() => setError('')}
      />
    </form>
    </EntryWithDayList>
  )
}
