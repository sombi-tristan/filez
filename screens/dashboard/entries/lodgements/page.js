'use client'

import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from '@/lib/nav'
import { Check, ChevronDown, ClipboardPaste, X } from 'lucide-react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { lodgementsRepo } from '@/lib/repositories/lodgements'
import DateInput from '@/components/DateInput'
import { useSavePush } from '@/components/SavePushProvider'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, ENTRY_DATE } from '@/components/ui'
import {
  EntryScreen, DayBar, EntryCard, Field, FieldRow, NumberInput, SubscribeNotice,
  SaveBar, EntryLoading, NotConfigured, adjacentDates, Figures, figure,
} from '@/components/entries/EntryParts'
import { EntryWithDayList, DayEntries } from '@/components/entries/DayEntries'
import { dayTotalSales } from '@/lib/salesCalculations'
import { readPosLines } from '@/lib/posPaste'

/** What distinguishes two accounts at the same bank: the POS terminal, or the type (with its terminal, if it has one). */
function bankSub(b) {
  if (!b) return ''
  if (b.lodgement_type === 'pos') return b.terminal_id || 'POS'
  if (b.lodgement_type === 'transfer' && b.terminal_id) return `transfer · ${b.terminal_id}`
  return b.lodgement_type || ''
}

function blankEntry() {
  return { _key: crypto.randomUUID(), id: null, amount: '', bankId: '', lodgementType: 'deposit', salesDate: new Date().toISOString().split('T')[0], notes: '' }
}

export default function LodgementsFormPage() {
  const searchParams = useSearchParams()
  const { promptPush } = useSavePush()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'fuel-operations')

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [banks, setBanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([blankEntry()])
  // Which entry's account picker is open, as an index. Same bottom sheet as the daily-sales
  // consumption picker: chosen one-handed on a phone, so the options belong in thumb reach.
  const [bankSheet, setBankSheet] = useState(null)
  // The Paste POS lines sheet: what was pasted (Bedbug copies one line per slip amount), or null when closed.
  const [pasted, setPasted] = useState(null)
  const [originalIds, setOriginalIds] = useState([])
  const [allDates, setAllDates] = useState([])
  const submittingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const bnk = await db.banks.where('orgId').equals(orgId).toArray()
      if (bnk.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      setBanks(bnk)

      if (editId) {
        const entry = await lodgementsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries([{
            _key: entry.id, id: entry.id,
            amount: String(entry.amount ?? ''),
            bankId: entry.bankId || '',
            lodgementType: entry.lodgementType || 'deposit',
            salesDate: entry.salesDate || '',
            notes: entry.notes || '',
          }])
        }
      } else if (editDate && !cancelled) {
        // A day opened from the list or the arrows: an empty form, its entries listed beside it.
        setFormDate(editDate)
        setOriginalIds([])
        setEntries([blankEntry()])
      }

      if (!cancelled) {
        const allLodgements = await db.lodgements.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allLodgements.map(e => e.entryDate).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  // One entry in the form at a time; the day's saved entries are listed beside it.
  const toForm = (e) => ({
    _key: e.id, id: e.id,
    amount: String(e.amount ?? ''),
    bankId: e.bankId || '',
    lodgementType: e.lodgementType || 'deposit',
    salesDate: e.salesDate || '',
    notes: e.notes || '',
  })
  const clearForm = () => { setOriginalIds([]); setEntries([blankEntry()]) }

  // Another day: an empty form, and that day's entries in the list.
  const handleDateChange = (newDate) => {
    setFormDate(newDate)
    clearForm()
  }

  const dayEntries = useLiveQuery(
    () => (orgId && formDate
      ? db.lodgements.where('orgId').equals(orgId).filter((e) => e.entryDate === formDate).toArray().then((r) => r.sort(byCreatedAt))
      : []),
    [orgId, formDate], []
  )
  const savedDates = useLiveQuery(
    () => (orgId ? db.lodgements.where('orgId').equals(orgId).toArray().then((all) => [...new Set(all.map((e) => e.entryDate).filter(Boolean))].sort()) : []),
    [orgId], null
  )
  // What a sales date sold and what has been lodged for it, for the figures under each entry.
  const station = useLiveQuery(
    async () => (orgId
      ? {
          sales: await db.dailySales.where('orgId').equals(orgId).toArray(),
          nozzles: await db.nozzles.where('orgId').equals(orgId).toArray(),
          tanks: await db.tanks.where('orgId').equals(orgId).toArray(),
          lodgements: await db.lodgements.where('orgId').equals(orgId).toArray(),
        }
      : null),
    [orgId], null
  )

  const editEntry = (item) => {
    const entry = dayEntries.find((e) => e.id === item.id)
    if (!entry) return
    setOriginalIds([entry.id])
    setEntries([toForm(entry)])
    setError('')
  }

  const deleteEntry = async (item) => {
    await lodgementsRepo.remove(item.id, orgId)
    if (originalIds.includes(item.id)) clearForm()
  }

  // Map bank lodgement_type to form lodgementType
  const bankTypeToFormType = (bankType) => {
    if (bankType === 'pos') return 'pos'
    if (bankType === 'transfer') return 'transfer'
    return 'deposit'
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e
      const updated = { ...e, [field]: value }
      // Auto-set lodgementType when bank changes
      if (field === 'bankId') {
        const bank = banks.find(b => b.id === value)
        if (bank) updated.lodgementType = bankTypeToFormType(bank.lodgement_type)
      }
      return updated
    }))
  }

  const isEditing = originalIds.length > 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i].bankId) { setError(`Entry ${i + 1}: Bank account is required`); submittingRef.current = false; return }
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
          await lodgementsRepo.remove(id, orgId)
        }
      }

      for (const [i, entry] of entries.entries()) {
        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          amount: Number(entry.amount) || 0,
          bankId: entry.bankId,
          lodgementType: entry.lodgementType,
          salesDate: entry.salesDate || formDate,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await lodgementsRepo.getById(entry.id)
          await lodgementsRepo.update({ ...existing, ...record })
        } else {
          // Distinct, increasing createdAt by position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await lodgementsRepo.create(record)
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

  const { prev: prevDate, next: nextDate } = adjacentDates(savedDates || allDates, formDate)
  const bankName = (id) => { const b = banks.find((x) => x.id === id); return b ? `${b.bank_name}${bankSub(b) ? ` · ${bankSub(b)}` : ''}` : 'No account' }
  const listItems = (dayEntries || []).map((e) => ({ id: e.id, entry: e, primary: `₦${Number(e.amount || 0).toLocaleString()}`, secondary: bankName(e.bankId) }))
  const dayHref = (d) => d && `/dashboard/entries/lodgements?${qs}&edit_date=${d}`

  return (
    <EntryScreen wide>
      <EntryWithDayList list={<DayEntries items={listItems} editingId={originalIds[0]} onEdit={editEntry} onDelete={deleteEntry} />}>
      <form onSubmit={handleSubmit}>
        <DayBar label="Entry date" value={formDate} onChange={handleDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

        {!subLoading && !isSubscribed && <SubscribeNotice />}

        {!isEditing && (
          <button type="button" onClick={() => setPasted('')} className="mb-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-500/[0.12] hover:bg-primary-500/[0.2]">
            <ClipboardPaste className="w-4 h-4" /> Paste POS lines
          </button>
        )}

        {entries.map((entry, idx) => {
          const chosen = banks.find((b) => b.id === entry.bankId)
          return (
            <EntryCard key={entry._key} title={isEditing ? 'Editing entry' : 'New entry'}>
              <Field label="Bank account">
                <button
                  type="button"
                  onClick={() => setBankSheet(idx)}
                  className="entry-fill w-full flex items-center gap-2 px-3 py-3 text-left text-base bg-primary-500/[0.12] hover:bg-primary-500/[0.2]"
                >
                  <span className={`flex-1 truncate ${chosen ? 'text-content' : 'text-content-faint'}`}>
                    {chosen ? chosen.bank_name : 'Select account'}
                    {chosen && <span className="text-content-faint"> · {bankSub(chosen)}</span>}
                  </span>
                  <ChevronDown className="w-5 h-5 text-content-faint flex-shrink-0" />
                </button>
              </Field>
              <FieldRow cols={2} keep>
                <Field label="Amount (₦)">
                  <NumberInput value={entry.amount} onValue={(v) => updateEntry(idx, 'amount', v)} placeholder="0.00" />
                </Field>
                <Field label="Type">
                  <div className="px-3 py-2.5 text-base text-content-muted capitalize">{entry.lodgementType || '—'}</div>
                </Field>
              </FieldRow>
              <Field label="Sales date">
                <DateInput value={entry.salesDate} onChange={(v) => updateEntry(idx, 'salesDate', v)} className={ENTRY_DATE} />
              </Field>
              {station && (() => {
                // The sales date against what is lodged for it (saved, and this form as typed),
                // the Daily Sales Report's way: lodgements go by their sales date, and the cash
                // balance is the sales less POS and transfers.
                const day = entry.salesDate || formDate
                const typeOf = (bankId) => banks.find((b) => b.id === bankId)?.lodgement_type
                const forDay = [
                  ...station.lodgements.filter((l) => !originalIds.includes(l.id) && (l.salesDate || l.entryDate) === day),
                  ...entries.filter((e) => (e.salesDate || formDate) === day),
                ]
                const lodged = forDay.reduce((t, l) => t + (Number(l.amount) || 0), 0)
                const posAndTransfer = forDay
                  .filter((l) => ['pos', 'transfer'].includes(typeOf(l.bankId)))
                  .reduce((t, l) => t + (Number(l.amount) || 0), 0)
                const sales = dayTotalSales(station.sales, station.nozzles, station.tanks, day)
                const cash = sales - posAndTransfer
                return (
                  <Figures items={[
                    { label: 'Sales', value: `₦${figure(sales)}` },
                    { label: 'Lodged', value: `₦${figure(lodged)}` },
                    { label: 'Cash balance', value: `₦${figure(cash)}`, bad: cash < 0 },
                  ]} />
                )
              })()}
              <Field label="Notes">
                <textarea value={entry.notes} onChange={(e) => updateEntry(idx, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
              </Field>
            </EntryCard>
          )
        })}

        {isEditing && (
          <button type="button" onClick={clearForm} className="mb-2 text-sm font-medium text-content-muted hover:text-content">
            Cancel editing
          </button>
        )}

        <SaveBar
          listHref={`/dashboard/entries/lodgements/list?${qs}`}
          saving={saving}
          saved={saved}
          isEditing={isEditing}
          disabled={!subLoading && !isSubscribed}
          error={error}
          onErrorDone={() => setError('')}
        />
      </form>
      </EntryWithDayList>

      {/* Paste POS lines: one entry card per line whose terminal and type match an account; the
          rest stay listed here in red with the reason. Cards already filled in are kept. */}
      {pasted !== null && (() => {
        const { entries: found, problems } = readPosLines(pasted, banks)
        const fill = () => {
          const kept = entries.filter((e) => e.amount || e.bankId)
          setEntries([...kept, ...found.map((f) => ({ ...blankEntry(), ...f }))])
          setPasted(null)
        }
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setPasted(null)}>
            <div className="bg-surface w-full sm:max-w-md max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-content">Paste POS lines</h3>
                  <p className="text-xs text-content-muted">From Bedbug: date, POS or TRANSFER, terminal, amount</p>
                </div>
                <button type="button" onClick={() => setPasted(null)} aria-label="Close" className="text-content-faint hover:text-content-muted p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-4 py-3 flex flex-col gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                <textarea
                  aria-label="POS lines"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={6}
                  autoFocus
                  placeholder={'2026-10-25	POS	2039DDE3	471980.00'}
                  className={`${ENTRY_INPUT} font-mono text-sm`}
                />
                {problems.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm text-red-600 dark:text-red-400">
                    {problems.map((p, i) => (
                      <li key={i} className="flex gap-1.5">
                        <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span><span className="font-mono">{p.line}</span>: {p.reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" disabled={found.length === 0} onClick={fill} className="px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-40">
                  {`Fill ${found.length} ${found.length === 1 ? 'entry' : 'entries'}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Account / terminal sheet — the same picker as the daily-sales consumption account.
          A station has a handful of accounts and several POS terminals at the same bank, so
          the terminal is shown beside each name; that is usually the only thing telling two
          rows apart. */}
      {bankSheet !== null && (() => {
        const entry = entries[bankSheet]
        if (!entry) return null
        const ordered = [...banks].sort(
          (a, b) => (a.bank_name || '').localeCompare(b.bank_name || '') ||
            bankSub(a).localeCompare(bankSub(b))
        )
        const pick = (val) => { updateEntry(bankSheet, 'bankId', val); setBankSheet(null) }
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setBankSheet(null)}>
            <div className="bg-surface w-full sm:max-w-md max-h-[55vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-content">Bank Account</h3>
                  <p className="text-xs text-content-muted">Entry {bankSheet + 1}</p>
                </div>
                <button type="button" onClick={() => setBankSheet(null)} className="text-content-faint hover:text-content-muted p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-line">
                {ordered.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-content-muted text-center">No bank accounts set up for this station yet.</p>
                ) : ordered.map((b) => {
                  const selected = b.id === entry.bankId
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => pick(b.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${selected ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-800 font-medium' : 'text-content hover:bg-subtle'}`}
                    >
                      <span className="flex-1 truncate">
                        {b.bank_name}
                        <span className={selected ? 'text-primary-600' : 'text-content-faint'}> · {bankSub(b)}</span>
                      </span>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {entry.bankId && (
                <div className="px-4 py-2 border-t border-line flex-shrink-0"
                     style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
                  <button type="button" onClick={() => pick('')} className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-300">
                    Clear selection
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </EntryScreen>
  )
}
