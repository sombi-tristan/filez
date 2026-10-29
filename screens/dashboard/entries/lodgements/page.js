'use client'

import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from '@/lib/nav'
import { Check, ChevronDown, ClipboardPaste, Plus, Trash2, X } from 'lucide-react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { lodgementsRepo } from '@/lib/repositories/lodgements'
import DateInput from '@/components/DateInput'
import { useSavePush } from '@/components/SavePushProvider'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, ENTRY_DATE } from '@/components/ui'
import {
  EntryScreen, DayBar, EntryCard, Field, NumberInput, SubscribeNotice,
  SaveBar, EntryLoading, NotConfigured, adjacentDates, Figures, figure,
} from '@/components/entries/EntryParts'
import { EntryWithDayList, DayEntries } from '@/components/entries/DayEntries'
import { dayTotalSales } from '@/lib/salesCalculations'
import { sortBanks } from '@/lib/lodgementCalculations'
import { readPosLines } from '@/lib/posPaste'

/** What distinguishes two accounts at the same bank: the POS terminal, or the type (with its terminal, if it has one). */
function bankSub(b) {
  if (!b) return ''
  if (b.lodgement_type === 'pos') return b.terminal_id || 'POS'
  if (b.lodgement_type === 'transfer' && b.terminal_id) return `transfer · ${b.terminal_id}`
  return b.lodgement_type || ''
}

const TYPE_LABEL = { pos: 'POS', transfer: 'Transfer', bank_deposit: 'Deposit', cash: 'Cash', other: 'Other' }

/** The line under an account's name: its terminal, if it has one (POS, or a transfer's), and its type. */
function accountLine(b) {
  return [['pos', 'transfer'].includes(b.lodgement_type) && b.terminal_id, TYPE_LABEL[b.lodgement_type] || b.lodgement_type].filter(Boolean).join(' · ')
}

// Map bank lodgement_type to the record's lodgementType
function bankTypeToFormType(bankType) {
  if (bankType === 'pos') return 'pos'
  if (bankType === 'transfer') return 'transfer'
  return 'deposit'
}

/**
 * The day's sheet: a row for every POS, transfer (and cash or other) account, each with its
 * amount, and a deposit row where the bank is chosen, since a deposit goes to the bank and not
 * to a terminal. Saving makes one entry for each row with an amount.
 */
function blankRows(banks) {
  const accounts = sortBanks(banks.filter((b) => b.lodgement_type !== 'bank_deposit'))
    .map((b) => ({ _key: b.id, id: null, bankId: b.id, amount: '', fixed: true }))
  return [...accounts, blankDeposit()]
}

function blankDeposit() {
  return { _key: crypto.randomUUID(), id: null, bankId: '', amount: '', fixed: false }
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
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split('T')[0])
  const [rows, setRows] = useState([])
  // Which deposit row's bank picker is open, by its key. A bottom sheet, the same as the
  // daily-sales consumption picker: chosen one-handed on a phone, so the options are in thumb reach.
  const [bankSheet, setBankSheet] = useState(null)
  // The Paste POS lines sheet: what was pasted (Bedbug copies one line per slip amount), or null when closed.
  const [pasted, setPasted] = useState(null)
  const [originalIds, setOriginalIds] = useState([])
  const [allDates, setAllDates] = useState([])
  const submittingRef = useRef(false)

  // An entry being edited: its own row alone, the account fixed unless it is a deposit.
  const toRows = (e, bnk) => {
    const bank = bnk.find((b) => b.id === e.bankId)
    return [{ _key: e.id, id: e.id, bankId: e.bankId || '', amount: String(e.amount ?? ''), fixed: !!bank && bank.lodgement_type !== 'bank_deposit' }]
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      const bnk = await db.banks.where('orgId').equals(orgId).toArray()
      if (bnk.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      setBanks(bnk)

      if (editId) {
        const entry = await lodgementsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setSalesDate(entry.salesDate || entry.entryDate || '')
          setOriginalIds([entry.id])
          setRows(toRows(entry, bnk))
        }
      } else {
        // A day opened from the list or the arrows: an empty sheet, its entries listed beside it.
        if (editDate) { setFormDate(editDate); setSalesDate(editDate) }
        setOriginalIds([])
        setRows(blankRows(bnk))
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

  const clearForm = () => { setOriginalIds([]); setRows(blankRows(banks)) }

  // Another day: an empty sheet for it, and that day's entries in the list.
  const handleDateChange = (newDate) => {
    setFormDate(newDate)
    setSalesDate(newDate)
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
  // What the sales date sold and what has been lodged for it, for the figures under the sheet.
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
    setSalesDate(entry.salesDate || entry.entryDate || formDate)
    setRows(toRows(entry, banks))
    setError('')
  }

  const deleteEntry = async (item) => {
    await lodgementsRepo.remove(item.id, orgId)
    if (originalIds.includes(item.id)) clearForm()
  }

  const updateRow = (key, field, value) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)))
  }
  const addDeposit = () => setRows((prev) => [...prev, blankDeposit()])
  const removeRow = (key) => setRows((prev) => prev.filter((r) => r._key !== key))

  const isEditing = originalIds.length > 0
  const filled = (r) => r.amount !== '' && Number(r.amount) !== 0

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    const toSave = isEditing ? rows : rows.filter(filled)
    const fail = (msg) => { setError(msg); submittingRef.current = false }
    if (toSave.length === 0) return fail('Enter an amount to lodge')
    if (toSave.some((r) => !r.bankId)) return fail('Choose the bank for the deposit')
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const nowMs = Date.now()

      for (const [i, row] of toSave.entries()) {
        const bank = banks.find((b) => b.id === row.bankId)
        const record = {
          id: row.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          amount: Number(row.amount) || 0,
          bankId: row.bankId,
          salesDate: salesDate || formDate,
          updatedAt: now,
        }

        if (row.id) {
          const existing = await lodgementsRepo.getById(row.id)
          // A lube deposit keeps its type; anything else takes its account's.
          const lodgementType = existing?.lodgementType === 'lube-deposit' ? existing.lodgementType : bankTypeToFormType(bank?.lodgement_type)
          await lodgementsRepo.update({ ...existing, ...record, lodgementType })
        } else {
          // Distinct, increasing createdAt by position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          record.lodgementType = bankTypeToFormType(bank?.lodgement_type)
          record.notes = ''
          await lodgementsRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush()
      // Ready for the next sheet: what was saved is in the day's list.
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
  const depositBanks = banks.filter((b) => b.lodgement_type === 'bank_deposit')
    .sort((a, b) => (a.bank_name || '').localeCompare(b.bank_name || ''))
  const deposits = rows.filter((r) => !r.fixed)

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

        <EntryCard title={isEditing ? 'Editing entry' : 'New lodgements'}>
          {/* Each account on two lines: its bank and the amount, then its terminal and type. */}
          {rows.map((row) => {
            const bank = banks.find((b) => b.id === row.bankId)
            return (
              <div key={row._key} className="px-3 py-2">
                <div className="flex items-center gap-3">
                  {row.fixed ? (
                    <span className="flex-1 min-w-0 truncate text-base text-content">{bank?.bank_name || 'Account'}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setBankSheet(row._key)}
                      className="entry-fill flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left text-base bg-primary-500/[0.12] hover:bg-primary-500/[0.2]"
                    >
                      <span className={`flex-1 truncate ${bank ? 'text-content' : 'text-content-faint'}`}>{bank ? bank.bank_name : 'Select bank'}</span>
                      <ChevronDown className="w-5 h-5 text-content-faint flex-shrink-0" />
                    </button>
                  )}
                  <div className="w-36 sm:w-44 shrink-0">
                    <NumberInput
                      value={row.amount}
                      onValue={(v) => updateRow(row._key, 'amount', v)}
                      placeholder="₦0.00"
                      aria-label={`Amount for ${bank ? bank.bank_name : 'deposit'}`}
                      className={`${ENTRY_INPUT} text-right tabular-nums`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1 text-[13px] text-content-faint">
                  <span className="truncate">{row.fixed ? accountLine(bank || {}) : 'Deposit'}</span>
                  {!row.fixed && !isEditing && deposits.length > 1 && (
                    <button type="button" onClick={() => removeRow(row._key)} aria-label="Remove deposit" className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:text-red-700">
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          {!isEditing && (
            <button type="button" onClick={addDeposit} className="w-full flex items-center gap-1.5 px-3 py-2.5 text-[15px] font-medium text-primary-600 hover:bg-primary-500/10">
              <Plus className="w-4 h-4" /> Another deposit
            </button>
          )}
          <Field label="Sales date">
            <DateInput value={salesDate} onChange={setSalesDate} className={ENTRY_DATE} />
          </Field>
          {station && (() => {
            // The sales date against what is lodged for it (saved, and this sheet as typed), the
            // Daily Sales Report's way: lodgements go by their sales date, and the cash balance is
            // the sales less POS and transfers.
            const day = salesDate || formDate
            const typeOf = (bankId) => banks.find((b) => b.id === bankId)?.lodgement_type
            const forDay = [
              ...station.lodgements.filter((l) => !originalIds.includes(l.id) && (l.salesDate || l.entryDate) === day),
              ...rows,
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
        </EntryCard>

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

      {/* Paste POS lines: each line's amount goes into the row of the account whose terminal and
          type it matches (two slips from one terminal add up), and the lines' date becomes the
          sales date. The rest stay listed here in red with the reason. */}
      {pasted !== null && (() => {
        const { entries: found, problems } = readPosLines(pasted, banks)
        const fill = () => {
          const byBank = new Map()
          for (const f of found) byBank.set(f.bankId, (byBank.get(f.bankId) || 0) + Number(f.amount))
          setRows((prev) => prev.map((r) => (r.fixed && byBank.has(r.bankId) ? { ...r, amount: byBank.get(r.bankId).toFixed(2) } : r)))
          if (found[0]?.salesDate) setSalesDate(found[0].salesDate)
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
                  {`Fill ${found.length} ${found.length === 1 ? 'amount' : 'amounts'}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* The deposit's bank: a deposit goes to the bank, not a terminal, so only the banks with
          a deposit account are offered, by name. */}
      {bankSheet !== null && (() => {
        const row = rows.find((r) => r._key === bankSheet)
        if (!row) return null
        const pick = (val) => { updateRow(bankSheet, 'bankId', val); setBankSheet(null) }
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setBankSheet(null)}>
            <div className="bg-surface w-full sm:max-w-md max-h-[55vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line flex-shrink-0">
                <h3 className="text-sm font-semibold text-content">Deposit bank</h3>
                <button type="button" onClick={() => setBankSheet(null)} className="text-content-faint hover:text-content-muted p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-line">
                {depositBanks.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-content-muted text-center">No bank deposit accounts yet. Add one under Lodgements in the station&rsquo;s settings.</p>
                ) : depositBanks.map((b) => {
                  const selected = b.id === row.bankId
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => pick(b.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${selected ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-800 font-medium' : 'text-content hover:bg-subtle'}`}
                    >
                      <span className="flex-1 truncate">{b.bank_name}</span>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {row.bankId && (
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
