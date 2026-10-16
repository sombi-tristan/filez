'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { customerPaymentsRepo } from '@/lib/repositories/customerPayments'
import SearchableSelect from '@/components/SearchableSelect'
import { useSavePush } from '@/components/SavePushProvider'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, ENTRY_SELECT } from '@/components/ui'
import {
  EntryScreen, DayBar, EntryCard, Field, FieldRow, NumberInput, AddEntryButton, SubscribeNotice,
  SaveBar, EntryLoading, NotConfigured, adjacentDates,
} from '@/components/entries/EntryParts'

function blankEntry() {
  return { _key: crypto.randomUUID(), id: null, customerId: '', amountPaid: '', salesAmount: '', notes: '' }
}

export default function CustomerPaymentsFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { promptPush } = useSavePush()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'customer-payments')

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [customers, setCustomers] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankEntry()])
  const [originalIds, setOriginalIds] = useState([])
  const [allDates, setAllDates] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const custs = await db.customers.where('orgId').equals(orgId).toArray()
      if (custs.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      setCustomers(custs)

      if (editId) {
        const entry = await customerPaymentsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            customerId: entry.customerId || '',
            amountPaid: String(entry.amountPaid ?? ''),
            salesAmount: String(entry.salesAmount ?? ''),
            notes: entry.notes || '',
          }])
        }
      } else if (editDate) {
        const all = await db.customerPayments.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate).sort(byCreatedAt)
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            customerId: e.customerId || '',
            amountPaid: String(e.amountPaid ?? ''),
            salesAmount: String(e.salesAmount ?? ''),
            notes: e.notes || '',
          })))
        }
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.customerPayments.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today).sort(byCreatedAt)
        if (dateEntries.length > 0 && !cancelled) {
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(dateEntries.map(e => ({
            _key: e.id, id: e.id,
            customerId: e.customerId || '',
            amountPaid: String(e.amountPaid ?? ''),
            salesAmount: String(e.salesAmount ?? ''),
            notes: e.notes || '',
          })))
        }
      }

      if (!cancelled) {
        const allPayments = await db.customerPayments.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allPayments.map(e => e.entryDate).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  // When date changes in create mode, auto-load existing entries for that date
  const handleDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.customerPayments.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate).sort(byCreatedAt)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(dateEntries.map(e => ({
        _key: e.id, id: e.id,
        customerId: e.customerId || '',
        amountPaid: String(e.amountPaid ?? ''),
        salesAmount: String(e.salesAmount ?? ''),
        notes: e.notes || '',
      })))
    } else {
      setOriginalIds([])
      setEntries([blankEntry()])
    }
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => setEntries(prev => [...prev, blankEntry()])

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].customerId) { setError(`Entry ${i + 1}: Customer is required`); submittingRef.current = false; return }
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
          await customerPaymentsRepo.remove(id, orgId)
        }
      }

      for (const [i, entry] of entries.entries()) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          customerId: entry.customerId,
          amountPaid: Number(entry.amountPaid) || 0,
          salesAmount: Number(entry.salesAmount) || 0,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await customerPaymentsRepo.getById(entry.id)
          await customerPaymentsRepo.update({ ...existing, ...record })
        } else {
          // Distinct, increasing createdAt by position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await customerPaymentsRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/customer-payments/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <EntryLoading />

  if (locked) return <NotConfigured orgId={orgId} />

  const { prev: prevDate, next: nextDate } = adjacentDates(allDates, formDate)
  const dayHref = (d) => d && `/dashboard/entries/customer-payments?${qs}&edit_date=${d}`

  return (
    <EntryScreen>
      <form onSubmit={handleSubmit}>
        <DayBar label="Transaction date" value={formDate} onChange={handleDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

        {!subLoading && !isSubscribed && <SubscribeNotice />}

        {entries.map((entry, idx) => (
          <EntryCard key={entry._key} title={`Entry ${idx + 1}`} onRemove={entries.length > 1 ? () => removeEntry(idx) : null}>
            <Field label="Account">
              <SearchableSelect
                value={entry.customerId}
                onChange={(val) => updateEntry(idx, 'customerId', val)}
                options={customers.map((c) => ({ value: c.id, label: c.name, sub: c.phone || '' }))}
                placeholder="Select account"
                className={ENTRY_SELECT}
              />
            </Field>
            <FieldRow cols={2} keep>
              <Field label="Amount paid (₦)">
                <NumberInput value={entry.amountPaid} onValue={(v) => updateEntry(idx, 'amountPaid', v)} placeholder="0.00" />
              </Field>
              <Field label="Sales amount (₦)">
                <NumberInput value={entry.salesAmount} onValue={(v) => updateEntry(idx, 'salesAmount', v)} placeholder="0.00" />
              </Field>
            </FieldRow>
            <Field label="Notes">
              <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
            </Field>
          </EntryCard>
        ))}

        <AddEntryButton onClick={addEntry} />

        <SaveBar
          listHref={`/dashboard/entries/customer-payments/list?${qs}`}
          saving={saving}
          saved={saved}
          isEditing={isEditing}
          disabled={!subLoading && !isSubscribed}
          error={error}
          onErrorDone={() => setError('')}
        />
      </form>
    </EntryScreen>
  )
}
