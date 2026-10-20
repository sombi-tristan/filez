'use client'

import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from '@/lib/nav'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { lubeOnAccount } from '@/lib/accountBalance'
import { customerPaymentsRepo } from '@/lib/repositories/customerPayments'
import SearchableSelect from '@/components/SearchableSelect'
import { useSavePush } from '@/components/SavePushProvider'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, ENTRY_SELECT } from '@/components/ui'
import {
  EntryScreen, DayBar, EntryCard, Field, FieldRow, NumberInput, SubscribeNotice,
  SaveBar, EntryLoading, NotConfigured, adjacentDates, Figures, figure,
} from '@/components/entries/EntryParts'
import { EntryWithDayList, DayEntries } from '@/components/entries/DayEntries'
import { isDefaultAccount } from '@/lib/defaultAccounts'

/** A balance as the Account Ledger reads it: above zero the account owes the station. */
const balanceText = (b) => (b > 0 ? `₦${figure(b)} owed` : b < 0 ? `₦${figure(-b)} in credit` : '₦0')

function blankEntry() {
  return { _key: crypto.randomUUID(), id: null, customerId: '', amountPaid: '', salesAmount: '', notes: '' }
}

// One entry in the form; the day's saved entries are listed beside it (components/entries/DayEntries.js).
function toForm(e) {
  return {
    _key: e.id, id: e.id,
    customerId: e.customerId || '',
    amountPaid: String(e.amountPaid ?? ''),
    salesAmount: String(e.salesAmount ?? ''),
    notes: e.notes || '',
  }
}

export default function CustomerPaymentsFormPage() {
  const searchParams = useSearchParams()
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
          setEntries([toForm(entry)])
        }
      } else if (editDate && !cancelled) {
        // A day opened from the list or the arrows: an empty form, its entries listed beside it.
        setFormDate(editDate)
        setOriginalIds([])
        setEntries([blankEntry()])
      }

      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  const clearForm = () => { setOriginalIds([]); setEntries([blankEntry()]) }

  // Another day: an empty form, and that day's entries in the list.
  const handleDateChange = (newDate) => {
    setFormDate(newDate)
    clearForm()
  }

  const dayEntries = useLiveQuery(
    () => (orgId && formDate
      ? db.customerPayments.where('orgId').equals(orgId).filter((e) => e.entryDate === formDate).toArray().then((r) => r.sort(byCreatedAt))
      : []),
    [orgId, formDate], []
  )
  const savedDates = useLiveQuery(
    () => (orgId ? db.customerPayments.where('orgId').equals(orgId).toArray().then((all) => [...new Set(all.map((e) => e.entryDate).filter(Boolean))].sort()) : []),
    [orgId], []
  )
  // Every saved transaction of the station, for each account's balance under its entry.
  // Lube sales on an account count in its balance as well (lib/accountBalance.js).
  const allPayments = useLiveQuery(
    async () => (orgId
      ? [
          ...await db.customerPayments.where('orgId').equals(orgId).toArray(),
          ...lubeOnAccount(await db.lubeSales.where('orgId').equals(orgId).toArray(), await db.lubeProducts.where('orgId').equals(orgId).toArray()),
        ]
      : []),
    [orgId], []
  )

  const editEntry = (item) => {
    const entry = dayEntries.find((e) => e.id === item.id)
    if (!entry) return
    setOriginalIds([entry.id])
    setEntries([toForm(entry)])
    setError('')
  }

  const deleteEntry = async (item) => {
    await customerPaymentsRepo.remove(item.id, orgId)
    if (originalIds.includes(item.id)) clearForm()
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const isEditing = originalIds.length > 0

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].customerId) { setError('Customer is required'); submittingRef.current = false; return }
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
          // Distinct, increasing createdAt by position so the day's entries keep their order
          // when it is reopened (the list sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await customerPaymentsRepo.create(record)
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

  if (locked) return <NotConfigured orgId={orgId} />

  const { prev: prevDate, next: nextDate } = adjacentDates(savedDates || [], formDate)
  const dayHref = (d) => d && `/dashboard/entries/customer-payments?${qs}&edit_date=${d}`
  const customerName = (id) => customers.find((c) => c.id === id)?.name || 'No account'
  const listItems = (dayEntries || []).map((e) => ({
    id: e.id,
    primary: `${customerName(e.customerId)}`,
    secondary: `Paid ₦${Number(e.amountPaid || 0).toLocaleString()} · Sales ₦${Number(e.salesAmount || 0).toLocaleString()}`,
  }))

  return (
    <EntryScreen wide>
      <EntryWithDayList list={<DayEntries items={listItems} editingId={originalIds[0]} onEdit={editEntry} onDelete={deleteEntry} />}>
      <form onSubmit={handleSubmit}>
        <DayBar label="Transaction date" value={formDate} onChange={handleDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

        {!subLoading && !isSubscribed && <SubscribeNotice />}

        {entries.map((entry, idx) => (
          <EntryCard key={entry._key} title={isEditing ? 'Editing entry' : 'New entry'}>
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
            {(() => {
              // The account's balance before this transaction and after it, the Account Ledger's
              // way: opening balance + every sale - every payment up to the day (the entry being
              // edited left out). The default accounts (consumption) carry no balance.
              const account = customers.find((c) => c.id === entry.customerId)
              if (!account || isDefaultAccount(account)) return null
              const before = (allPayments || [])
                .filter((p) => p.customerId === account.id && p.entryDate <= formDate && !originalIds.includes(p.id))
                .reduce((b, p) => b + (Number(p.salesAmount) || 0) - (Number(p.amountPaid) || 0), Number(account.opening_balance) || 0)
              const after = before + (Number(entry.salesAmount) || 0) - (Number(entry.amountPaid) || 0)
              return (
                <Figures items={[
                  { label: 'Balance before', value: balanceText(before) },
                  { label: 'After this', value: balanceText(after) },
                ]} />
              )
            })()}
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
          listHref={`/dashboard/entries/customer-payments/list?${qs}`}
          saving={saving}
          saved={saved}
          isEditing={isEditing}
          disabled={!subLoading && !isSubscribed}
          error={error}
          onErrorDone={() => setError('')}
        />
      </form>
      </EntryWithDayList>
    </EntryScreen>
  )
}
