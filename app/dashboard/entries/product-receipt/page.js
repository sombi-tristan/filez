'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSubscription } from '@/lib/hooks/useSubscription'
import { db } from '@/lib/db'
import { productReceiptsRepo } from '@/lib/repositories/productReceipts'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'
import { useSavePush } from '@/components/SavePushProvider'
import { orderedCreatedAt, byCreatedAt } from '@/lib/entryOrder'
import { ENTRY_INPUT, ENTRY_DATE } from '@/components/ui'
import {
  EntryScreen, DayBar, EntryCard, EntryTabs, Field, FieldGroup, FieldRow, NumberInput, AddEntryButton,
  SubscribeNotice, SaveBar, EntryLoading, NotConfigured, adjacentDates,
} from '@/components/entries/EntryParts'

function blankEntry(tanks) {
  return {
    _key: crypto.randomUUID(),
    ids: [],
    loadedDate: '', driverName: '', waybillNumber: '', ticketNumber: '', truckNumber: '',
    chartHighUllage1: '', chartHighUllage2: '', chartHighUllage3: '',
    chartLowUllage1: '', chartLowUllage2: '', chartLowUllage3: '',
    chartLiquidHeight1: '', chartLiquidHeight2: '', chartLiquidHeight3: '',
    depotUllage1: '', depotUllage2: '', depotUllage3: '',
    depotLiquidHeight1: '', depotLiquidHeight2: '', depotLiquidHeight3: '',
    stationUllage1: '', stationUllage2: '', stationUllage3: '',
    stationLiquidHeight1: '', stationLiquidHeight2: '', stationLiquidHeight3: '',
    highVol1: '', highVol2: '', highVol3: '',
    lowVol1: '', lowVol2: '', lowVol3: '',
    tankVolumes: Object.fromEntries(tanks.map(t => [t.id, ''])),
    depotName: '', arrivalTime: '', exitTime: '', notes: '',
  }
}

/**
 * Group raw DB records (one per tank) into form entries (one per delivery).
 * Groups by shared delivery fields; old single-tank entries become their own group.
 */
function groupRecordsIntoEntries(records, tanks) {
  const groups = {}
  for (const r of records) {
    // Group key: shared delivery info (waybill + truck + driver + depot + loadedDate)
    const parts = [r.waybillNumber, r.truckNumber, r.driverName, r.depotName, r.loadedDate].map(s => s || '')
    const key = parts.some(Boolean) ? parts.join('|') : r.id
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }
  return Object.values(groups).map(group => {
    const first = group[0]
    const tankVolumes = Object.fromEntries(tanks.map(t => [t.id, '']))
    const ids = []
    for (const r of group) {
      ids.push(r.id)
      if (r.tankId && Number(r.actualVolume || 0) > 0) {
        tankVolumes[r.tankId] = String(r.actualVolume)
      }
    }
    return {
      _key: first.id,
      ids,
      loadedDate: first.loadedDate || '',
      driverName: first.driverName || '',
      waybillNumber: first.waybillNumber || '',
      ticketNumber: first.ticketNumber || '',
      truckNumber: first.truckNumber || '',
      chartHighUllage1: first.chartHighUllage1 ?? first.chartUllage1 ?? first.chartUllage ?? '',
      chartHighUllage2: first.chartHighUllage2 ?? first.chartUllage2 ?? '',
      chartHighUllage3: first.chartHighUllage3 ?? first.chartUllage3 ?? '',
      chartLowUllage1: first.chartLowUllage1 ?? '',
      chartLowUllage2: first.chartLowUllage2 ?? '',
      chartLowUllage3: first.chartLowUllage3 ?? '',
      chartLiquidHeight1: first.chartLiquidHeight1 ?? first.chartLiquidHeight ?? '',
      chartLiquidHeight2: first.chartLiquidHeight2 ?? '',
      chartLiquidHeight3: first.chartLiquidHeight3 ?? '',
      depotUllage1: first.depotUllage1 ?? first.depotUllage ?? '',
      depotUllage2: first.depotUllage2 ?? '',
      depotUllage3: first.depotUllage3 ?? '',
      depotLiquidHeight1: first.depotLiquidHeight1 ?? first.depotLiquidHeight ?? '',
      depotLiquidHeight2: first.depotLiquidHeight2 ?? '',
      depotLiquidHeight3: first.depotLiquidHeight3 ?? '',
      stationUllage1: first.stationUllage1 ?? first.stationUllage ?? '',
      stationUllage2: first.stationUllage2 ?? '',
      stationUllage3: first.stationUllage3 ?? '',
      stationLiquidHeight1: first.stationLiquidHeight1 ?? first.stationLiquidHeight ?? '',
      stationLiquidHeight2: first.stationLiquidHeight2 ?? '',
      stationLiquidHeight3: first.stationLiquidHeight3 ?? '',
      highVol1: first.highVol1 ?? first.firstCompartment ?? '',
      highVol2: first.highVol2 ?? first.secondCompartment ?? '',
      highVol3: first.highVol3 ?? first.thirdCompartment ?? '',
      lowVol1: first.lowVol1 ?? '',
      lowVol2: first.lowVol2 ?? '',
      lowVol3: first.lowVol3 ?? '',
      tankVolumes,
      depotName: first.depotName || '',
      arrivalTime: first.arrivalTime || '',
      exitTime: first.exitTime || '',
      notes: first.notes || '',
    }
  })
}

export default function ProductReceiptFormPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { promptPush } = useSavePush()
  const orgId = searchParams.get('org_id') || ''
  const editId = searchParams.get('edit') || null
  const editDate = searchParams.get('edit_date') || null
  const qs = `org_id=${orgId}`
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'fuel-operations')

  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [tanks, setTanks] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [entries, setEntries] = useState([])
  const [activeTab, setActiveTab] = useState(0)
  const [originalIds, setOriginalIds] = useState([])
  const [allDates, setAllDates] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!orgId) { setLoading(false); return }

      if (cancelled) return

      const tnk = await db.tanks.where('orgId').equals(orgId).toArray()
      if (tnk.length === 0) { setLocked(true); setLoading(false); return }
      if (cancelled) return
      const fuelOrder = { PMS: 0, AGO: 1, DPK: 2 }
      tnk.sort((a, b) => (fuelOrder[a.fuel_type] ?? 99) - (fuelOrder[b.fuel_type] ?? 99) || Number(a.tank_number || 0) - Number(b.tank_number || 0))
      setTanks(tnk)

      if (editId) {
        const entry = await productReceiptsRepo.getById(editId)
        if (entry && !cancelled) {
          setFormDate(entry.entryDate || '')
          setOriginalIds([entry.id])
          setEntries(groupRecordsIntoEntries([entry], tnk))
        }
      } else if (editDate) {
        const all = await db.productReceipts.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === editDate).sort(byCreatedAt)
        if (dateEntries.length > 0 && !cancelled) {
          setFormDate(editDate)
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(groupRecordsIntoEntries(dateEntries, tnk))
        }
      } else {
        // Create mode: auto-load existing entries for today's date
        const today = new Date().toISOString().split('T')[0]
        const all = await db.productReceipts.where('orgId').equals(orgId).toArray()
        const dateEntries = all.filter(e => e.entryDate === today).sort(byCreatedAt)
        if (dateEntries.length > 0 && !cancelled) {
          setOriginalIds(dateEntries.map(e => e.id))
          setEntries(groupRecordsIntoEntries(dateEntries, tnk))
        }
      }

      if (!cancelled) {
        const allReceipts = await db.productReceipts.where('orgId').equals(orgId).toArray()
        const uniqueDates = [...new Set(allReceipts.map(e => e.entryDate).filter(Boolean))].sort()
        setAllDates(uniqueDates)
        setEntries(prev => prev.length > 0 ? prev : [blankEntry(tnk)])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [editId, editDate, orgId])

  const isEditing = !!(editId || editDate || originalIds.length > 0)

  // When date changes in create mode, auto-load existing entries for that date
  const handleDateChange = async (newDate) => {
    setFormDate(newDate)
    if (editId || editDate || !orgId || !newDate) return
    const all = await db.productReceipts.where('orgId').equals(orgId).toArray()
    const dateEntries = all.filter(e => e.entryDate === newDate).sort(byCreatedAt)
    if (dateEntries.length > 0) {
      setOriginalIds(dateEntries.map(e => e.id))
      setEntries(groupRecordsIntoEntries(dateEntries, tanks))
    } else {
      setOriginalIds([])
      setEntries([blankEntry(tanks)])
    }
  }

  const updateEntry = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const addEntry = () => {
    setEntries(prev => [...prev, blankEntry(tanks)])
    setActiveTab(entries.length)
  }

  const removeEntry = (idx) => {
    if (entries.length === 1) return
    setEntries(prev => prev.filter((_, i) => i !== idx))
    setActiveTab(Math.min(activeTab, entries.length - 2))
  }

  const submittingRef = useRef(false)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setSaving(true)
    setError('')

    try {
      const now = new Date().toISOString()
      const nowMs = Date.now()
      // One record per tank, so the counter runs across the whole save rather than
      // per entry: records come back grouped by entry, tanks in order within each.
      let seq = 0

      // Delete all old records when editing
      if (isEditing) {
        for (const id of originalIds) {
          await productReceiptsRepo.remove(id, orgId)
        }
      }

      for (const entry of entries) {
        // Create one record per tank with volume > 0
        const tanksWithVolume = Object.entries(entry.tankVolumes || {}).filter(([, v]) => Number(v) > 0)

        for (const [tankId, volumeStr] of tanksWithVolume) {
          const record = {
            id: crypto.randomUUID(),
            orgId,
            entryDate: formDate,
            loadedDate: entry.loadedDate || null,
            driverName: entry.driverName,
            waybillNumber: entry.waybillNumber,
            ticketNumber: entry.ticketNumber,
            truckNumber: entry.truckNumber,
            chartHighUllage1: Number(entry.chartHighUllage1) || 0,
            chartHighUllage2: Number(entry.chartHighUllage2) || 0,
            chartHighUllage3: Number(entry.chartHighUllage3) || 0,
            chartLowUllage1: Number(entry.chartLowUllage1) || 0,
            chartLowUllage2: Number(entry.chartLowUllage2) || 0,
            chartLowUllage3: Number(entry.chartLowUllage3) || 0,
            chartLiquidHeight1: Number(entry.chartLiquidHeight1) || 0,
            chartLiquidHeight2: Number(entry.chartLiquidHeight2) || 0,
            chartLiquidHeight3: Number(entry.chartLiquidHeight3) || 0,
            depotUllage1: Number(entry.depotUllage1) || 0,
            depotUllage2: Number(entry.depotUllage2) || 0,
            depotUllage3: Number(entry.depotUllage3) || 0,
            depotLiquidHeight1: Number(entry.depotLiquidHeight1) || 0,
            depotLiquidHeight2: Number(entry.depotLiquidHeight2) || 0,
            depotLiquidHeight3: Number(entry.depotLiquidHeight3) || 0,
            stationUllage1: Number(entry.stationUllage1) || 0,
            stationUllage2: Number(entry.stationUllage2) || 0,
            stationUllage3: Number(entry.stationUllage3) || 0,
            stationLiquidHeight1: Number(entry.stationLiquidHeight1) || 0,
            stationLiquidHeight2: Number(entry.stationLiquidHeight2) || 0,
            stationLiquidHeight3: Number(entry.stationLiquidHeight3) || 0,
            highVol1: Number(entry.highVol1) || 0,
            highVol2: Number(entry.highVol2) || 0,
            highVol3: Number(entry.highVol3) || 0,
            lowVol1: Number(entry.lowVol1) || 0,
            lowVol2: Number(entry.lowVol2) || 0,
            lowVol3: Number(entry.lowVol3) || 0,
            actualVolume: Number(volumeStr) || 0,
            depotName: entry.depotName,
            tankId,
            arrivalTime: entry.arrivalTime || '',
            exitTime: entry.exitTime || '',
            notes: entry.notes,
            createdAt: orderedCreatedAt(nowMs, seq++),
            updatedAt: now,
          }
          await productReceiptsRepo.create(record)
        }
      }

      setSaving(false)
      setSaved(true)
      promptPush(() => router.push(`/dashboard/entries/product-receipt/list?${qs}`))
    } catch (err) {
      setError('Failed to save')
      setSaving(false)
      submittingRef.current = false
    }
  }

  if (loading) return <EntryLoading />

  if (locked) return <NotConfigured orgId={orgId} />

  const current = entries[activeTab]

  const { prev: prevDate, next: nextDate } = adjacentDates(allDates, formDate)
  const dayHref = (d) => d && `/dashboard/entries/product-receipt?${qs}&edit_date=${d}`

  // Per compartment readings, three across: short numbers fit side by side on a phone.
  const COMPARTMENT_ROWS = [
    ['stationUllage', 'Station ullage'],
    ['stationLiquidHeight', 'Station liquid height'],
    ['chartHighUllage', 'Chart highest ullage'],
    ['chartLowUllage', 'Chart lowest ullage'],
    ['chartLiquidHeight', 'Chart liquid height'],
    ['depotUllage', 'Depot ullage'],
    ['depotLiquidHeight', 'Depot liquid height'],
    ['highVol', 'Highest volume'],
    ['lowVol', 'Lowest volume'],
  ]

  return (
    <EntryScreen>
      <form onSubmit={handleSubmit} onKeyDown={(e) => { if (e.key === 'Enter' && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { e.preventDefault(); const fields = Array.from(e.currentTarget.querySelectorAll('input, select, textarea')); const idx = fields.indexOf(e.target); if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus() } }}>
        <DayBar label="Entry date" value={formDate} onChange={handleDateChange} prevHref={dayHref(prevDate)} nextHref={dayHref(nextDate)} />

        {!subLoading && !isSubscribed && <SubscribeNotice />}

        <EntryTabs count={entries.length} active={activeTab} onChange={setActiveTab} />

        {current && (
          <EntryCard
            title={entries.length > 1 ? `Entry ${activeTab + 1} of ${entries.length}` : 'Receipt'}
            onRemove={entries.length > 1 ? () => removeEntry(activeTab) : null}
          >
            <FieldGroup title="Delivery">
              <FieldRow cols={2}>
                <Field label="Loaded date">
                  <DateInput value={current.loadedDate} onChange={(v) => updateEntry(activeTab, 'loadedDate', v)} className={ENTRY_DATE} />
                </Field>
                <Field label="Depot name">
                  <input type="text" value={current.depotName} onChange={(e) => updateEntry(activeTab, 'depotName', e.target.value)} enterKeyHint="next" className={ENTRY_INPUT} />
                </Field>
              </FieldRow>
              <FieldRow cols={2}>
                <Field label="Driver name">
                  <input type="text" value={current.driverName} onChange={(e) => updateEntry(activeTab, 'driverName', e.target.value)} enterKeyHint="next" autoCapitalize="words" className={ENTRY_INPUT} />
                </Field>
                <Field label="Truck number">
                  <input type="text" value={current.truckNumber} onChange={(e) => updateEntry(activeTab, 'truckNumber', e.target.value)} enterKeyHint="next" autoCapitalize="characters" className={ENTRY_INPUT} />
                </Field>
              </FieldRow>
              <FieldRow cols={2} keep>
                <Field label="Waybill no.">
                  <input type="text" value={current.waybillNumber} onChange={(e) => updateEntry(activeTab, 'waybillNumber', e.target.value)} enterKeyHint="next" className={ENTRY_INPUT} />
                </Field>
                <Field label="Ticket no.">
                  <input type="text" value={current.ticketNumber} onChange={(e) => updateEntry(activeTab, 'ticketNumber', e.target.value)} enterKeyHint="next" className={ENTRY_INPUT} />
                </Field>
              </FieldRow>
              <FieldRow cols={2} keep>
                <Field label="Arrival time">
                  <input type="time" value={current.arrivalTime} onChange={(e) => updateEntry(activeTab, 'arrivalTime', e.target.value)} className={ENTRY_INPUT} />
                </Field>
                <Field label="Exit time">
                  <input type="time" value={current.exitTime} onChange={(e) => updateEntry(activeTab, 'exitTime', e.target.value)} className={ENTRY_INPUT} />
                </Field>
              </FieldRow>
            </FieldGroup>

            {COMPARTMENT_ROWS.map(([key, title]) => (
              <FieldGroup key={key} title={title}>
                <FieldRow cols={3} keep>
                  {[1, 2, 3].map((n) => (
                    <Field key={n} label={`Comp ${n}`}>
                      <NumberInput value={current[`${key}${n}`]} onValue={(v) => updateEntry(activeTab, `${key}${n}`, v)} />
                    </Field>
                  ))}
                </FieldRow>
              </FieldGroup>
            ))}

            <FieldGroup title="Volume received per tank (litres)">
              {tanks.map((t) => (
                <FieldRow key={t.id} cols={2} keep>
                  <div className="flex items-center px-3 py-2.5 bg-subtle/50">
                    <span className="text-[15px] text-content-muted">{t.fuel_type} Tank {t.tank_number}</span>
                  </div>
                  <NumberInput
                    value={current.tankVolumes?.[t.id] || ''}
                    onValue={(v) => updateEntry(activeTab, 'tankVolumes', { ...current.tankVolumes, [t.id]: v })}
                    placeholder="0"
                    aria-label={`${t.fuel_type} Tank ${t.tank_number} litres`}
                  />
                </FieldRow>
              ))}
            </FieldGroup>

            <Field label="Notes">
              <textarea value={current.notes} onChange={(e) => updateEntry(activeTab, 'notes', e.target.value)} rows={2} maxLength={500} className={`${ENTRY_INPUT} resize-none`} />
            </Field>
          </EntryCard>
        )}

        <AddEntryButton onClick={addEntry} label="Add another receipt" />

        <SaveBar
          listHref={`/dashboard/entries/product-receipt/list?${qs}`}
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
