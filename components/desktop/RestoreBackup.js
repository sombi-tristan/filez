'use client'

import { useRef, useState } from 'react'
import { Upload, Loader2, AlertTriangle } from 'lucide-react'
import Modal from '@/components/Modal'
import { getCurrentStationId, setCurrentStationId } from '@/lib/local/link'
import { BTN_DANGER, BTN_FRAMED, BTN_PRIMARY } from '@/components/ui'

/**
 * Desktop build: restore a backup file into a station, whichever station it came from
 * (lib/local/routes/local/backup, lib/local/restoreInto.js). A warning first says what differs,
 * then the choice: overwrite everything, or pad the station with what it lacks.
 *
 *   intoNew  make a new station named after the backup first (Add a station), and overwrite it
 *   className, children  the trigger's own look and content, in place of the framed button
 *            (This computer's list card: components/ThisComputer.js)
 */
const SETUP_NAMES = {
  station_tanks: 'tanks', station_pumps: 'pumps', station_banks: 'banks',
  station_customers: 'customers', station_lube_products: 'lube products', imprest_periods: 'imprest periods',
}
const ENTRY_NAMES = {
  daily_sales_entries: 'daily sales', lodgement_entries: 'lodgements', product_receipt_entries: 'product receipts',
  lube_sales_entries: 'lube sales', lube_stock_entries: 'lube stock', customer_payment_entries: 'account payments', imprest_entries: 'imprest entries',
}

function list(byTable) {
  return Object.entries(SETUP_NAMES)
    .filter(([t]) => byTable[t]?.length)
    .map(([t, name]) => `${byTable[t].length} ${name} (${byTable[t].slice(0, 6).join(', ')}${byTable[t].length > 6 ? ', …' : ''})`)
}

export default function RestoreBackup({ disabled = false, label = 'Restore backup', intoNew = false, className, children }) {
  const fileRef = useRef(null)
  const [backup, setBackup] = useState(null)
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const post = async (body) => {
    const res = await fetch('/api/local/backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error || 'Restore failed')
    return out
  }

  const choose = async (file) => {
    setError(''); setSummary(null); setBackup(null)
    if (!file) return
    let parsed
    try { parsed = JSON.parse(await file.text()) } catch { setError('That file is not a backup'); setBackup({}); return }
    setBackup(parsed)
    if (intoNew) return
    try { setSummary((await post({ backup: parsed, preview: true })).summary) } catch (e) { setError(e.message) }
  }

  const restore = async (mode) => {
    setBusy(true); setError('')
    try {
      let stationId = getCurrentStationId()
      if (intoNew) {
        const name = backup?.tables?.organizations?.[0]?.name || 'Restored station'
        const res = await fetch('/api/local/stations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
        const made = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(made.error || 'Could not add the station')
        stationId = made.station.id
      }
      const out = await post({ backup, mode, stationId })
      setCurrentStationId(out.station.id)
      // A full load: the station opens afresh, its screens rebuilt from what was restored.
      window.location.href = `/dashboard/stations/${out.station.id}`
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const close = () => { if (!busy) { setBackup(null); setSummary(null); setError('') } }
  const name = backup?.tables?.organizations?.[0]?.name
  const counts = summary && Object.entries(ENTRY_NAMES).filter(([t]) => summary.backup[t]).map(([t, n]) => `${summary.backup[t]} ${n}`)

  return (
    <>
      <button type="button" onClick={() => fileRef.current?.click()} disabled={disabled || busy} className={className || `flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_FRAMED}`}>
        {children || <><Upload className="w-4 h-4" /> {label}</>}
      </button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
        onChange={(e) => { choose(e.target.files?.[0] || null); e.target.value = '' }} />

      <Modal open={!!backup} onClose={close} title="Restore backup?">
        <div className="space-y-4">
          {intoNew ? (
            <p className="text-sm text-content">
              A new station, <strong>{name || 'from the backup'}</strong>, is added to this computer with everything in the backup:
              its setup, opening balances and entries.
            </p>
          ) : !summary && !error ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-content-faint" /></div>
          ) : summary ? (
            <div className="space-y-3 text-sm text-content">
              <p>
                The backup{summary.name ? <> of <strong>{summary.name}</strong></> : null} holds {counts.length ? counts.join(', ') : 'no entries'}.
              </p>
              {list(summary.missing).length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-subtle border border-line rounded-house">
                  <AlertTriangle className="w-4 h-4 text-content-muted flex-shrink-0 mt-0.5" />
                  <p><strong>Not in this station yet, and will be created:</strong> {list(summary.missing).join('; ')}.</p>
                </div>
              )}
              {list(summary.extra).length > 0 && (
                <p className="text-content-muted"><strong>In this station but not in the backup:</strong> {list(summary.extra).join('; ')}.</p>
              )}
              <p className="text-content-muted">
                <strong>Overwrite everything:</strong> this station becomes exactly the backup, and its own setup and entries are removed.
                {' '}<strong>Pad with new values:</strong> it keeps everything it has and gains only what is missing, and the backup&apos;s
                entries come in for days it has none of that kind.
              </p>
            </div>
          ) : null}
          {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={close} disabled={busy} className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}>Cancel</button>
            {intoNew ? (
              <button onClick={() => restore('overwrite')} disabled={busy || !name} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_PRIMARY}`}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Add the station
              </button>
            ) : summary ? (
              <>
                <button onClick={() => restore('pad')} disabled={busy} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_PRIMARY}`}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Pad with new values
                </button>
                <button onClick={() => restore('overwrite')} disabled={busy} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 ${BTN_DANGER}`}>
                  Overwrite everything
                </button>
              </>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  )
}
