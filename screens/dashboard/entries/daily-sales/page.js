'use client'

import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSearchParams } from '@/lib/nav'
import { Loader2, Trash2, AlertTriangle, User, X, Check } from 'lucide-react'
import { db } from '@/lib/db'
import { dailySalesRepo } from '@/lib/repositories/dailySales'
import Toggle from '@/components/Toggle'
import { useSavePush } from '@/components/SavePushProvider'
import { fmtDate } from '@/lib/formatDate'
import { isDefaultAccount } from '@/lib/defaultAccounts'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, BTN_DANGER, BTN_FRAMED } from '@/components/ui'
import {
  EntryScreen, DayBar, EntryCard, Field, FieldGroup, FieldRow, NumberInput,
  SaveBar, EntryLoading, NotConfigured, adjacentDates,
} from '@/components/entries/EntryParts'
import { EntryWithDayList, DayEntries } from '@/components/entries/DayEntries'
import { sortEntries } from '@/lib/salesCalculations'

// A nozzle row: the pump's number, then closing meter (wider), consumption, pour back and the
// computed actual sales. minmax(0, …) lets the columns shrink below an input's built-in width,
// or a phone scrolls sideways.
const NOZZLE_GRID = 'grid grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]'

/** Litres and naira as the form shows them: thousands separated, at most two decimals. */
const figure = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

/**
 * Each pump's opening meter for the entry in the form: the closing of the saved entry it
 * follows, in the order the reports put a station's entries (lib/salesCalculations.js
 * sortEntries: by date, then by meter within a day), so a second shift opens on the first.
 * With nothing before it, a pump opens on its initial reading. Only the form's date and the
 * latest date before it can hold that entry, so only those are sorted.
 */
function openingMeters(saved, editingIds, formDate, readings, nozzles) {
  const dateOf = (e) => e.entryDate || e.entry_date || ''
  const others = (saved || []).filter((e) => !editingIds.includes(e.id) && dateOf(e) <= formDate)
  const lastBefore = others.reduce((d, e) => (dateOf(e) < formDate && dateOf(e) > d ? dateOf(e) : d), '')
  const editing = (saved || []).find((e) => editingIds.includes(e.id))
  const form = {
    id: '￿',
    entryDate: formDate,
    // A new entry is the day's latest; one being edited keeps its place.
    createdAt: editing?.createdAt || '9999-12-31T23:59:59.999Z',
    nozzleReadings: readings
      .filter((r) => r.closing_meter !== '' && r.closing_meter != null)
      .map((r) => ({ pump_id: r.pump_id, closing_meter: Number(r.closing_meter) })),
  }
  const candidates = others
    .filter((e) => dateOf(e) === formDate || dateOf(e) === lastBefore)
    .map((e) => ({ ...e, entryDate: dateOf(e) }))
  const sorted = sortEntries([...candidates, form])
  const before = sorted[sorted.indexOf(form) - 1]
  const open = {}
  for (const n of nozzles) open[n.id] = Number(n.initial_reading || 0)
  for (const r of before?.nozzleReadings || []) {
    if (r.pump_id != null) open[r.pump_id] = Number(r.closing_meter || 0)
  }
  return open
}

function blankEntry(nozzles, tanks) {
  return {
    _key: crypto.randomUUID(),
    id: null,
    nozzleReadings: nozzles.map(n => ({
      pump_id: n.id,
      label: `${n.fuel_type} ${n.pump_number}`,
      fuel_type: n.fuel_type,
      closing_meter: '',
      consumption: '',
      pour_back: '',
      consumption_customer_id: '',
      pour_back_customer_id: '',
    })),
    tankReadings: tanks.map(t => ({
      tank_id: t.id,
      label: `${t.fuel_type} Tank ${t.tank_number}`,
      closing_stock: '',
    })),
    prices: { PMS: '', AGO: '', DPK: '' },
    closeOfBusiness: false,
    notes: '',
  }
}

function entryFromRecord(entry, nozzles, tanks) {
  const savedNozzles = entry.nozzleReadings || entry.nozzle_readings || []
  const savedTanks = entry.tankReadings || entry.tank_readings || []
  const p = entry.prices || {}
  return {
    _key: entry.id,
    id: entry.id,
    nozzleReadings: nozzles.map(n => {
      const match = savedNozzles.find(r => r.pump_id === n.id)
      return {
        pump_id: n.id,
        label: `${n.fuel_type} ${n.pump_number}`,
        fuel_type: n.fuel_type,
        closing_meter: match ? String(match.closing_meter || '') : '',
        consumption: match ? String(match.consumption || '') : '',
        pour_back: match ? String(match.pour_back || '') : '',
        consumption_customer_id: match?.consumption_customer_id || '',
        pour_back_customer_id: match?.pour_back_customer_id || '',
      }
    }),
    tankReadings: tanks.map(t => {
      const match = savedTanks.find(r => r.tank_id === t.id)
      return {
        tank_id: t.id,
        label: `${t.fuel_type} Tank ${t.tank_number}`,
        closing_stock: match ? String(match.closing_stock || '') : '',
      }
    }),
    prices: { PMS: String(p.PMS || ''), AGO: String(p.AGO || ''), DPK: String(p.DPK || '') },
    closeOfBusiness: entry.closeOfBusiness || entry.close_of_business || false,
    notes: entry.notes || '',
  }
}

export default function DailySalesFormPage() {
  const searchParams = useSearchParams()
  const { promptPush } = useSavePush()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [nozzles, setNozzles] = useState([])
  const [tanks, setTanks] = useState([])
  const [customers, setCustomers] = useState([])

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [originalIds, setOriginalIds] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingDay, setDeletingDay] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  // Previous day's last closing meter per pump_id — used when the user leaves a nozzle blank
  const [prevClosing, setPrevClosing] = useState({})
  const [prevTankClosing, setPrevTankClosing] = useState({})
  const [allDates, setAllDates] = useState([])
  const [consModal, setConsModal] = useState(null) // { entryIdx, nozzleIdx, type: 'consumption' | 'pour_back' }
  // Fields already offered the sheet once. Without this, every blur re-opens it and the
  // form becomes impossible to tab through after declining once.
  const autoPrompted = useRef(new Set())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const noz = await db.nozzles.where('orgId').equals(orgId).toArray()
      const tnk = await db.tanks.where('orgId').equals(orgId).toArray()

      if (noz.length === 0 && tnk.length === 0) {
        setLocked(true)
        setLoading(false)
        return
      }

      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      noz.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.pump_number || 0) - Number(b.pump_number || 0))
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setNozzles(noz)
      setTanks(tnk)

      const cust = await db.customers.where('orgId').equals(orgId).toArray()
      cust.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setCustomers(cust)

      if (editId) {
        const entry = await dailySalesRepo.getById(editId)
        if (entry && !cancelled) {
          const date = entry.entryDate || entry.entry_date || ''
          setFormDate(date)
          setOriginalIds([entry.id])
          const built = [entryFromRecord(entry, noz, tnk)]
          setEntries(built)
        }
      } else if (editDate && !cancelled) {
        // A day opened from the list or the arrows: an empty form, its entries listed beside it.
        setFormDate(editDate)
        setOriginalIds([])
        setEntries([blankEntry(noz, tnk)])
      }

      if (!cancelled) {
        const allSales = await db.dailySales.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allSales.map(e => e.entryDate || e.entry_date).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setEntries(prev => prev.length > 0 ? prev : [blankEntry(noz, tnk)])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  // Resolve the previous day's last closing meter readings from IndexedDB
  useEffect(() => {
    if (!orgId || !formDate) return
    const load = async () => {
      // Find the last entry before formDate (any previous date, not just yesterday)
      const allSales = await db.dailySales.where('orgId').equals(orgId).toArray()
      const prevEntries = allSales
        .filter(e => (e.entryDate || e.entry_date) < formDate)
        .sort((a, b) => (b.entryDate || b.entry_date || '').localeCompare(a.entryDate || a.entry_date || ''))

      if (!prevEntries.length) { setPrevClosing({}); setPrevTankClosing({}); return }

      // Get entries from the most recent previous date
      const lastDate = prevEntries[0].entryDate || prevEntries[0].entry_date
      const lastDateEntries = prevEntries.filter(e => (e.entryDate || e.entry_date) === lastDate)

      // Prefer the close-of-business entry; otherwise use the latest by createdAt
      const lastEntry =
        lastDateEntries.find(e => e.closeOfBusiness || e.close_of_business) ||
        lastDateEntries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]

      const map = {}
      for (const r of (lastEntry?.nozzleReadings || [])) {
        if (r.pump_id != null && r.closing_meter != null) {
          map[r.pump_id] = r.closing_meter
        }
      }
      setPrevClosing(map)

      const tankMap = {}
      for (const r of (lastEntry?.tankReadings || lastEntry?.tank_readings || [])) {
        if (r.tank_id != null && r.closing_stock != null) {
          tankMap[r.tank_id] = r.closing_stock
        }
      }
      setPrevTankClosing(tankMap)
    }
    load()
  }, [orgId, formDate])

  // One entry in the form at a time; the day's saved entries are listed beside it.
  const clearForm = () => {
    setOriginalIds([])
    setEntries([blankEntry(nozzles, tanks)])
    setActiveTab(0)
    autoPrompted.current = new Set()
  }

  // Another day: an empty form, and that day's entries in the list.
  const handleDateChange = (newDate) => {
    setFormDate(newDate)
    clearForm()
  }

  const dayEntries = useLiveQuery(
    () => (orgId && formDate
      ? db.dailySales.where('orgId').equals(orgId).filter((e) => (e.entryDate || e.entry_date) === formDate).toArray().then((r) => r.sort(byCreatedAt))
      : []),
    [orgId, formDate], []
  )
  const savedDates = useLiveQuery(
    () => (orgId ? db.dailySales.where('orgId').equals(orgId).toArray().then((all) => [...new Set(all.map((e) => e.entryDate || e.entry_date).filter(Boolean))].sort()) : []),
    [orgId], null
  )
  // Every saved entry of the station, for the openings the live actual sales start from.
  const savedSales = useLiveQuery(
    () => (orgId ? db.dailySales.where('orgId').equals(orgId).toArray() : []),
    [orgId], []
  )

  const editEntry = (item) => {
    const entry = (dayEntries || []).find((e) => e.id === item.id)
    if (!entry) return
    setOriginalIds([entry.id])
    setEntries([entryFromRecord(entry, nozzles, tanks)])
    setActiveTab(0)
    autoPrompted.current = new Set()
    setError('')
  }

  const deleteEntry = async (item) => {
    await dailySalesRepo.remove(item.id, orgId)
    if (originalIds.includes(item.id)) clearForm()
  }

  const isEditing = originalIds.length > 0
  // Only the station's default accounts (Police, Generator, Pour Back After Pump Repairs
  // and so on). A credit customer is not what consumption or pour back is booked to, and
  // listing every customer made the picker a search box for a list of about twenty.
  const defaultAccounts = customers
    .filter(isDefaultAccount)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  /**
   * Offer the account sheet when a consumption or pour-back field is left with a value and
   * no account attached — that pairing is always required, and it was easy to key a figure
   * and walk away without it. Offered once per field so declining is respected; the person
   * icon beside the field reopens it.
   */
  const maybePromptAccount = (entryIdx, nozzleIdx, type) => {
    const reading = entries[entryIdx]?.nozzleReadings?.[nozzleIdx]
    if (!reading) return
    const value = type === 'pour_back' ? reading.pour_back : reading.consumption
    if (!(Number(value) > 0)) return
    const field = type === 'pour_back' ? 'pour_back_customer_id' : 'consumption_customer_id'
    if (reading[field]) return
    const key = `${entryIdx}:${nozzleIdx}:${type}`
    if (autoPrompted.current.has(key)) return
    autoPrompted.current.add(key)
    setConsModal({ entryIdx, nozzleIdx, type })
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const updateNozzleReading = (entryIdx, nozzleIdx, field, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, nozzleReadings: e.nozzleReadings.map((r, j) => j === nozzleIdx ? { ...r, [field]: value } : r) }
    }))
  }

  const updateTankReading = (entryIdx, tankIdx, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, tankReadings: e.tankReadings.map((r, j) => j === tankIdx ? { ...r, closing_stock: value } : r) }
    }))
  }

  const updatePrice = (entryIdx, fuel, value) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== entryIdx) return e
      return { ...e, prices: { ...e.prices, [fuel]: value } }
    }))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (!entry.prices.PMS && !entry.prices.AGO && !entry.prices.DPK) {
        setError('At least one fuel price is required'); setActiveTab(i); submittingRef.current = false; return
      }
    }

    const cobEntries = entries.filter(e => e.closeOfBusiness)
    if (cobEntries.length > 1) {
      setError('Only one entry can be marked as close-of-business'); submittingRef.current = false; return
    }
    if (cobEntries.length === 1) {
      const dateEntries = await db.dailySales.where('orgId').equals(orgId).toArray()
      const existingCob = dateEntries.find(
        e => (e.entryDate || e.entry_date) === formDate
          && (e.closeOfBusiness || e.close_of_business)
          && !originalIds.includes(e.id)
      )
      if (existingCob) {
        setError('A close-of-business entry already exists for this date.'); submittingRef.current = false; return
      }
    }

    setSaving(true)
    setError('')

    try {
      const nowMs = Date.now()
      const now = new Date(nowMs).toISOString()
      const currentIds = entries.filter(e => e.id).map(e => e.id)

      if (isEditing) {
        const deletedIds = originalIds.filter(id => !currentIds.includes(id))
        for (const id of deletedIds) {
          await dailySalesRepo.remove(id, orgId)
        }
      }

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const readings = entry.nozzleReadings.map(r => ({
          pump_id: r.pump_id,
          nozzle_label: r.label,
          fuel_type: r.fuel_type,
          closing_meter: r.closing_meter !== '' && r.closing_meter !== undefined
            ? Number(r.closing_meter)
            : (prevClosing[r.pump_id] ?? 0),
          consumption: Number(r.consumption) || 0,
          pour_back: Number(r.pour_back) || 0,
          consumption_customer_id: r.consumption_customer_id || '',
          pour_back_customer_id: r.pour_back_customer_id || '',
        }))
        const tankData = entry.tankReadings.map(r => ({
          tank_id: r.tank_id,
          tank_label: r.label,
          closing_stock: r.closing_stock !== '' && r.closing_stock !== undefined
            ? Number(r.closing_stock)
            : Number(prevTankClosing[r.tank_id] ?? 0),
        }))

        const record = {
          id: entry.id || crypto.randomUUID(),
          orgId,
          entryDate: formDate,
          nozzleReadings: readings,
          tankReadings: tankData,
          prices: {
            PMS: Number(entry.prices.PMS) || 0,
            AGO: Number(entry.prices.AGO) || 0,
            DPK: Number(entry.prices.DPK) || 0,
          },
          closeOfBusiness: entry.closeOfBusiness,
          notes: entry.notes,
          updatedAt: now,
        }

        if (entry.id) {
          const existing = await dailySalesRepo.getById(entry.id)
          await dailySalesRepo.update({ ...existing, ...record })
        } else {
          // Distinct, increasing createdAt by tab position so a multi-entry save keeps its
          // order when the day is reopened (the loader sorts entries by createdAt).
          record.createdAt = orderedCreatedAt(nowMs, i)
          await dailySalesRepo.create(record)
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

  // Every entry of the day in the date bar (the day the list shows).
  const deleteWholeDay = async () => {
    if (!formDate) return
    setDeletingDay(true)
    setDeleteError('')
    try {
      await dailySalesRepo.removeByDate(orgId, formDate)
      clearForm()
      setConfirmDelete(false)
      setDeletingDay(false)
    } catch (err) {
      // Shown rather than swallowed: a half-cleared day is worth knowing about immediately.
      setDeleteError(`Could not delete: ${err?.message || err}`)
      setDeletingDay(false)
    }
  }

  if (loading) return <EntryLoading />

  if (locked) return <NotConfigured orgId={orgId} />

  const current = entries[activeTab]

  // Actual sales as the form is filled in, the reports' way (lib/buildDailyReport.js): the
  // closing meter (blank: the opening) less the opening, consumption and pour back; per fuel,
  // its litres at the price entered above.
  const opening = current ? openingMeters(savedSales, originalIds, formDate, current.nozzleReadings, nozzles) : {}
  const actualOf = (r) => {
    const open = opening[r.pump_id] ?? 0
    const close = r.closing_meter !== '' && r.closing_meter != null ? Number(r.closing_meter) : open
    return close - open - (Number(r.consumption) || 0) - (Number(r.pour_back) || 0)
  }
  const fuelActual = (fuel) => (current?.nozzleReadings || []).filter((r) => r.fuel_type === fuel).reduce((t, r) => t + actualOf(r), 0)
  const fuelAmount = (fuel) => fuelActual(fuel) * (Number(current?.prices?.[fuel]) || 0)
  const readingFuels = [...new Set((current?.nozzleReadings || []).map((r) => r.fuel_type))]
  const dayAmount = readingFuels.reduce((t, f) => t + fuelAmount(f), 0)

  const { prev: prevDate, next: nextDate } = adjacentDates(savedDates || allDates, formDate)
  const dayHref = (d) => d && `/dashboard/entries/daily-sales?${qs}&edit_date=${d}`
  const dayCount = (dayEntries || []).length
  const listItems = (dayEntries || []).map((e) => {
    const p = e.prices || {}
    return {
      id: e.id,
      primary: (e.closeOfBusiness || e.close_of_business) ? 'Final entry (close of business)' : 'Entry',
      secondary: ['PMS', 'AGO', 'DPK'].filter((f) => Number(p[f]) > 0).map((f) => `${f} ₦${Number(p[f]).toLocaleString()}`).join(' · ') || 'No prices',
    }
  })

  // The litres field beside an account button: the button only once there are litres to book.
  const litresWithAccount = (idx, r, type) => {
    const field = type === 'pour_back' ? 'pour_back' : 'consumption'
    const hasValue = Number(r[field]) > 0
    const custId = type === 'pour_back' ? r.pour_back_customer_id : r.consumption_customer_id
    const custName = hasValue && custId ? customers.find(c => c.id === custId)?.name : null
    return (
      <div className="flex items-center">
        <NumberInput
          data-skip-enter
          aria-label={`${r.label} ${type === 'pour_back' ? 'pour back' : 'consumption'} (litres)`}
          value={r[field]}
          onValue={(v) => updateNozzleReading(activeTab, idx, field, v)}
          onBlur={() => maybePromptAccount(activeTab, idx, type)}
          placeholder="0"
        />
        {hasValue && (
          <button
            type="button"
            onClick={() => setConsModal({ entryIdx: activeTab, nozzleIdx: idx, type })}
            className={`flex-shrink-0 flex items-center justify-center w-11 h-11 ${custName ? 'text-primary-600 dark:text-primary-400' : 'text-content-faint hover:text-content-muted'}`}
            aria-label={custName ? `Account: ${custName}` : 'Attach account'}
            title={custName || 'Attach account'}
          >
            <User className="w-5 h-5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <EntryScreen wide>
      <EntryWithDayList list={<DayEntries items={listItems} editingId={originalIds[0]} onEdit={editEntry} onDelete={deleteEntry} />}>
      <form onSubmit={handleSubmit} onFocus={(e) => { if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.type === 'text')) e.target.select() }} onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
          e.preventDefault()
          const allFields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea'))
          const curIdx = allFields.indexOf(e.target)
          if (curIdx < 0) return
          for (let i = curIdx + 1; i < allFields.length; i++) {
            if (!allFields[i].hasAttribute('data-skip-enter')) { allFields[i].focus(); return }
          }
        }
      }}>
        <DayBar label="Date" value={formDate} onChange={handleDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

        {current && (
          <EntryCard title={isEditing ? 'Editing entry' : 'New entry'}>
            <FieldGroup title="Fuel prices (₦/litre)">
              <FieldRow cols={3} keep>
                {['PMS', 'AGO', 'DPK'].map((fuel) => (
                  <Field key={fuel} label={fuel}>
                    <NumberInput data-skip-enter value={current.prices[fuel]} onValue={(v) => updatePrice(activeTab, fuel, v)} placeholder="0.00" />
                  </Field>
                ))}
              </FieldRow>
            </FieldGroup>

            {current.nozzleReadings.length > 0 && (
              <FieldGroup title="Nozzle readings" aside={<span className="text-[13px] text-content-faint">Blank uses the last closing</span>}>
                {/* One heading per fuel naming the columns, then a row per pump: its number and the
                    closing meter, consumption and pour back fields, with no label of their own, so
                    the fields follow one another straight down the fuel, and its actual sales,
                    worked out as they are typed. The fuel's total and amount close it. */}
                {readingFuels.map((fuel) => (
                  <div key={fuel}>
                    <div className={`${NOZZLE_GRID} border-t border-line text-[13px] font-semibold text-content-muted`}>
                      <span className="px-3 py-1.5 text-content">{fuel}</span>
                      <span className="px-3 py-1.5">Meter</span>
                      <span className="px-3 py-1.5"><span className="sm:hidden">Cons.</span><span className="hidden sm:inline">Consumption (L)</span></span>
                      <span className="px-3 py-1.5"><span className="sm:hidden">P/B</span><span className="hidden sm:inline">Pour back (L)</span></span>
                      <span className="px-3 py-1.5 text-right">Actual<span className="hidden sm:inline"> (L)</span></span>
                    </div>
                    {current.nozzleReadings.map((r, idx) => {
                      if (r.fuel_type !== fuel) return null
                      const consCustName = Number(r.consumption) > 0 && r.consumption_customer_id
                        ? customers.find(c => c.id === r.consumption_customer_id)?.name
                        : null
                      const pbCustName = Number(r.pour_back) > 0 && r.pour_back_customer_id
                        ? customers.find(c => c.id === r.pour_back_customer_id)?.name
                        : null
                      return (
                        <div key={r.pump_id} className="border-t border-line">
                          <div className={NOZZLE_GRID}>
                            <span className="self-center px-3 text-[15px] font-semibold text-content-muted">{r.label.slice(fuel.length).trim()}</span>
                            <div className="min-w-0">
                              <NumberInput
                                aria-label={`${r.label} closing meter`}
                                value={r.closing_meter}
                                onValue={(v) => updateNozzleReading(activeTab, idx, 'closing_meter', v)}
                                placeholder={prevClosing[r.pump_id] != null ? String(prevClosing[r.pump_id]) : ''}
                              />
                            </div>
                            <div className="min-w-0 border-l border-line">{litresWithAccount(idx, r, 'consumption')}</div>
                            <div className="min-w-0 border-l border-line">{litresWithAccount(idx, r, 'pour_back')}</div>
                            <output
                              aria-label={`${r.label} actual sales (litres)`}
                              className={`min-w-0 self-center px-3 text-right text-[15px] font-semibold tabular-nums truncate ${actualOf(r) < 0 ? 'text-red-600 dark:text-red-400' : 'text-content'}`}
                            >
                              {figure(actualOf(r))}
                            </output>
                          </div>
                          {(consCustName || pbCustName) && (
                            <div className="px-3 pb-1 flex flex-wrap gap-x-3 text-[13px] text-primary-600 dark:text-primary-400">
                              {consCustName && <span>Consumption: {consCustName}</span>}
                              {pbCustName && <span>Pour back: {pbCustName}</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div className={`${NOZZLE_GRID} border-t border-line bg-subtle/60`}>
                      <span className="col-span-4 px-3 py-2 text-[13px] font-semibold text-content-muted">
                        {fuel} total
                        <span className="block text-content">
                          {figure(fuelActual(fuel))} L × ₦{figure(current.prices[fuel])} = ₦{figure(fuelAmount(fuel))}
                        </span>
                      </span>
                      <output aria-label={`${fuel} total actual sales (litres)`} className="self-center px-3 text-right text-[15px] font-bold tabular-nums truncate text-content">
                        {figure(fuelActual(fuel))}
                      </output>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
                  <span className="text-[15px] font-semibold text-content-muted">Total sales</span>
                  <output aria-label="Total sales (naira)" className="text-base font-bold tabular-nums text-content">₦{figure(dayAmount)}</output>
                </div>
              </FieldGroup>
            )}

            {nozzles.length === 0 && (
              <p className="px-3 py-3 text-[15px] text-content-muted">No nozzles found. Check your station setup or refresh.</p>
            )}

            {current.tankReadings.length > 0 && (
              <FieldGroup
                title="UGT closing stock"
                aside={<Toggle checked={current.closeOfBusiness} onChange={(v) => updateEntry(activeTab, 'closeOfBusiness', v)} label="Final entry" />}
              >
                {current.closeOfBusiness && current.tankReadings.map((r, idx) => (
                  <FieldRow key={r.tank_id} cols={2} keep>
                    <div className="flex items-center px-3 py-2.5 bg-subtle/50">
                      <span className="text-[15px] text-content-muted">{r.label}</span>
                    </div>
                    <Field label="Litres">
                      <NumberInput
                        value={r.closing_stock}
                        onValue={(v) => updateTankReading(activeTab, idx, v)}
                        placeholder={prevTankClosing[r.tank_id] != null ? String(prevTankClosing[r.tank_id]) : ''}
                      />
                    </Field>
                  </FieldRow>
                ))}
              </FieldGroup>
            )}

            {tanks.length === 0 && (
              <p className="px-3 py-3 text-[15px] text-content-muted">No tanks found. Check your station setup or refresh.</p>
            )}

            <Field label="Notes">
              <textarea data-skip-enter value={current.notes} onChange={(e) => updateEntry(activeTab, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
            </Field>
          </EntryCard>
        )}

        {isEditing && (
          <button type="button" onClick={clearForm} className="mb-2 text-sm font-medium text-content-muted hover:text-content">
            Cancel editing
          </button>
        )}

        <SaveBar
          listHref={`/dashboard/entries/daily-sales/list?${qs}`}
          saving={saving}
          saved={saved}
          isEditing={isEditing}
          error={error}
          onErrorDone={() => setError('')}
        />
      </form>

      {/* Danger zone — outside the <form> so the button can never submit it. Only offered
          when the day in the date bar has saved entries. */}
      {dayCount > 0 && (
        <div className="mt-10 border border-red-200 dark:border-red-900/50 bg-red-50/50">
          <div className="px-4 py-3 border-b border-red-200 dark:border-red-900/50">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Delete this day
            </h3>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-content-strong mb-4">
              Permanently deletes the {dayCount} {dayCount === 1 ? 'entry' : 'entries'} for{' '}
              <span className="font-semibold text-content">{fmtDate(formDate)}</span> so the day can be entered again from
              scratch. This cannot be undone and every report covering the date will change. Lodgements, receipts and lube are untouched.
            </p>
            {deleteError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>}
            <button
              type="button"
              onClick={() => { setDeleteError(''); setConfirmDelete(true) }}
              className="flex items-center gap-2 border border-red-300 text-red-700 dark:text-red-300 px-4 py-2 text-sm font-medium hover:bg-red-100 dark:bg-red-900/30"
            >
              <Trash2 className="w-4 h-4" /> Delete all entries for this day
            </button>
          </div>
        </div>
      )}
      </EntryWithDayList>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => (deletingDay ? null : setConfirmDelete(false))}>
          <div className="bg-surface w-full sm:max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-line">
              <h3 className="text-sm font-semibold text-content">Delete {fmtDate(formDate)}?</h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-content-muted mb-4">
                {dayCount} {dayCount === 1 ? 'entry' : 'entries'} will be permanently deleted. This cannot be undone.
              </p>
              {deleteError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deletingDay} className={`flex-1 px-3 py-2 text-sm font-medium disabled:opacity-50 ${BTN_FRAMED}`}>
                  Cancel
                </button>
                <button type="button" onClick={deleteWholeDay} disabled={deletingDay} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium disabled:opacity-50 ${BTN_DANGER}`}>
                  {deletingDay && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deletingDay ? 'Deleting…' : 'Delete day'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consumption / pour-back account sheet.
          A bottom sheet rather than a centred dialog: this is filled in one-handed on a
          phone at the pump, so the choices belong within thumb reach. It lists the station's
          default accounts only, one tap to pick — no search box for a list this short. */}
      {consModal && (() => {
        const r = entries[consModal.entryIdx]?.nozzleReadings[consModal.nozzleIdx]
        if (!r) return null
        const field = consModal.type === 'pour_back' ? 'pour_back_customer_id' : 'consumption_customer_id'
        const heading = consModal.type === 'pour_back' ? 'Pour Back Account' : 'Consumption Account'
        const currentValue = r[field]
        const litres = consModal.type === 'pour_back' ? r.pour_back : r.consumption
        const pick = (val) => {
          updateNozzleReading(consModal.entryIdx, consModal.nozzleIdx, field, val)
          setConsModal(null)
        }
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setConsModal(null)}>
            <div className="bg-surface w-full sm:max-w-md max-h-[55vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-line flex-shrink-0">
                <div>
                  <h3 className="text-sm font-semibold text-content">{heading}</h3>
                  <p className="text-xs text-content-muted">{r.label} · {Number(litres) || 0}L</p>
                </div>
                <button type="button" onClick={() => setConsModal(null)} className="text-content-faint hover:text-content-muted p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-line">
                {defaultAccounts.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-content-muted text-center">
                    No default accounts set up for this station yet.
                  </p>
                ) : defaultAccounts.map((c) => {
                  const selected = c.id === currentValue
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pick(c.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${selected ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-800 font-medium' : 'text-content hover:bg-subtle'}`}
                    >
                      <span className="flex-1">{c.name || 'Unnamed'}</span>
                      {selected && <Check className="w-4 h-4 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {currentValue && (
                <div className="px-4 py-2 border-t border-line flex-shrink-0"
                     style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
                  <button type="button" onClick={() => pick('')} className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-300">
                    Remove account
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
