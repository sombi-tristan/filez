'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  EntryScreen, DayBar, EntryCard, Field, FieldRow, NumberInput, AddEntryButton, SubscribeNotice,
  SaveBar, EntryLoading, NotConfigured, adjacentDates,
} from '@/components/entries/EntryParts'

function blankSalesEntry() {
  return { _key: crypto.randomUUID(), id: null, productId: '', unitSold: '', unitReceived: '', price: '', notes: '' }
}

function blankStockEntry() {
  return { _key: crypto.randomUUID(), id: null, productId: '', stock: '', notes: '' }
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
  const [allDates, setAllDates] = useState([])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    const load = async () => {
      const prods = await db.lubeProducts.where('orgId').equals(orgId).toArray()
      if (prods.length === 0) setLocked(true)
      setProducts(prods)

      const table = tab === 'stock' ? db.lubeStock : db.lubeSales
      const allEntries = await table.where('orgId').equals(orgId).toArray()
      const uniqueDates = [...new Set(allEntries.map(e => e.entryDate).filter(Boolean))].sort()
      setAllDates(uniqueDates)

      setLoading(false)
    }
    load()
  }, [orgId, tab])

  if (loading) return <EntryLoading />

  if (locked) return <NotConfigured orgId={orgId} />

  const formProps = { products, qs, orgId, editId, editDate, subBlocked, allDates }

  return (
    <EntryScreen>
      {!editId && !editDate && (
        <div className="mb-2 border-b-2 border-line">
          <Tabs
            label="Lube entry"
            items={[{ id: 'sales', label: 'Lube sales' }, { id: 'stock', label: 'Lube stock' }]}
            value={tab}
            onChange={setTab}
          />
        </div>
      )}

      {subBlocked && <SubscribeNotice />}

      {tab === 'sales'
        ? <LubeSalesForm {...formProps} />
        : <LubeStockForm {...formProps} />
      }
    </EntryScreen>
  )
}

function LubeSalesForm({ products, qs, orgId, editId, editDate, subBlocked, allDates }) {
  const router = useRouter()
  const { promptPush } = useSavePush()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankSalesEntry()])
  const [originalIds, setOriginalIds] = useState([])

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  useEffect(() => {
    const load = async () => {
      if (editId) {
        const entry = await lubeSalesRepo.getById(editId)
        if (entry) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            productId: entry.productId || '',
            unitSold: String(entry.unitSold ?? ''),
            unitReceived: String(entry.unitReceived ?? ''),
            price: String(entry.price ?? ''),
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        const all = await db.lubeSales.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate).sort(byCreatedAt)
        if (dateEntries.length > 0) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            productId: e.productId || '',
            unitSold: String(e.unitSold ?? ''),
            unitReceived: String(e.unitReceived ?? ''),
            price: String(e.price ?? ''),
            notes: e.notes || '',
          })))
        }
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.lubeSales.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today).sort(byCreatedAt)
        if (dateEntries.length > 0) {
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            productId: e.productId || '',
            unitSold: String(e.unitSold ?? ''),
            unitReceived: String(e.unitReceived ?? ''),
            price: String(e.price ?? ''),
            notes: e.notes || '',
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [editId, editDate, orgId])

  // When date changes in create mode, auto-load existing entries for that date
  const handleDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.lubeSales.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate).sort(byCreatedAt)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(dateEntries.map(e => ({
        _key: e.id, id: e.id,
        productId: e.productId || '',
        unitSold: String(e.unitSold ?? ''),
        unitReceived: String(e.unitReceived ?? ''),
        price: String(e.price ?? ''),
        notes: e.notes || '',
      })))
    } else {
      setOriginalIds([])
      setEntries([blankSalesEntry()])
    }
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankSalesEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError(`Entry ${i + 1}: Product is required`); submittingRef.current = false; return }
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
          // Distinct, increasing createdAt by position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await lubeSalesRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/lube/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <EntryLoading />

  const { prev: prevDate, next: nextDate } = adjacentDates(allDates, formDate)
  const dayHref = (d) => d && `/dashboard/entries/lube?${qs}&edit_date=${d}&type=sales`

  return (
    <form onSubmit={handleSubmit}>
      <DayBar label="Entry date" value={formDate} onChange={handleDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

      {entries.map((entry, idx) => (
        <EntryCard key={entry._key} title={`Entry ${idx + 1}`} onRemove={entries.length > 1 ? () => removeEntry(idx) : null}>
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

      <AddEntryButton onClick={addEntry} />

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
  )
}

function LubeStockForm({ products, qs, orgId, editId, editDate, subBlocked, allDates }) {
  const router = useRouter()
  const { promptPush } = useSavePush()
  const [loading, setLoading] = useState(!!(editId || editDate))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankStockEntry()])
  const [originalIds, setOriginalIds] = useState([])

  useEffect(() => {
    const load = async () => {
      if (editId) {
        const entry = await lubeStockRepo.getById(editId)
        if (entry) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            productId: entry.productId || '',
            stock: String(entry.stock ?? ''),
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        const all = await db.lubeStock.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate).sort(byCreatedAt)
        if (dateEntries.length > 0) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            productId: e.productId || '',
            stock: String(e.stock ?? ''),
            notes: e.notes || '',
          })))
        }
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.lubeStock.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today).sort(byCreatedAt)
        if (dateEntries.length > 0) {
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            productId: e.productId || '',
            stock: String(e.stock ?? ''),
            notes: e.notes || '',
          })))
        }
      }
      setLoading(false)
    }
    load()
  }, [editId, editDate, orgId])

  // When date changes in create mode, auto-load existing entries for that date
  const handleStockDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.lubeStock.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate).sort(byCreatedAt)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(dateEntries.map(e => ({
        _key: e.id, id: e.id,
        productId: e.productId || '',
        stock: String(e.stock ?? ''),
        notes: e.notes || '',
      })))
    } else {
      setOriginalIds([])
      setEntries([blankStockEntry()])
    }
  }

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankStockEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].productId) { setError(`Entry ${i + 1}: Product is required`); submittingRef.current = false; return }
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
          // Distinct, increasing createdAt by position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await lubeStockRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/lube/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <EntryLoading />

  const { prev: prevDate, next: nextDate } = adjacentDates(allDates, formDate)
  const dayHref = (d) => d && `/dashboard/entries/lube?${qs}&edit_date=${d}&type=stock`

  return (
    <form onSubmit={handleSubmit}>
      <DayBar label="Entry date" value={formDate} onChange={handleStockDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

      {entries.map((entry, idx) => (
        <EntryCard key={entry._key} title={`Entry ${idx + 1}`} onRemove={entries.length > 1 ? () => removeEntry(idx) : null}>
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

      <AddEntryButton onClick={addEntry} />

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
  )
}
