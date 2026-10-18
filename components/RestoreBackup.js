'use client'

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, AlertTriangle } from 'lucide-react'
import Modal from '@/components/Modal'
import { clearLocalData } from '@/lib/initialSync'
import { RESTORE_TABLES } from '@/lib/restoreInto'
import { BTN_DANGER, BTN_FRAMED, BTN_PRIMARY } from '@/components/ui'

/**
 * Restore from backup, the last row of the station switcher (components/StationSidebar.js): a
 * StationMGR Desktop backup file into this web station (app/api/stations/[stationId]/restore).
 * The row calls ref.pick(), which opens the file picker. A warning first says what differs,
 * then the choice: overwrite everything, or pad the station with what it lacks. The server
 * refuses it when the station is linked to a computer, has no subscription running, or this is
 * not its owner, and the reason is shown here.
 *
 * The picker and the warning are put on the page itself (a portal): the switcher lives in the
 * sidebar, which on a phone is a drawer that closes, and would take them with it.
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

// Only what a restore reads goes up: a request over the host's limit would never arrive.
function trimmed(backup) {
  const t = backup?.tables || {}
  return { ...backup, tables: Object.fromEntries(['organizations', ...RESTORE_TABLES].filter((k) => t[k]).map((k) => [k, t[k]])) }
}

const RestoreBackup = forwardRef(function RestoreBackup({ stationId }, ref) {
  const fileRef = useRef(null)
  const [backup, setBackup] = useState(null)
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Called from the row's click, so the browser still lets it open the file picker.
  useImperativeHandle(ref, () => ({ pick: () => fileRef.current?.click() }), [])

  const post = async (body) => {
    const res = await fetch(`/api/stations/${stationId}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const out = await res.json().catch(() => ({}))
    if (res.status === 413) throw new Error('That backup is too large to restore here')
    if (!res.ok) throw new Error(out.error || `Restore failed (${res.status})`)
    return out
  }

  const choose = async (file) => {
    setError(''); setSummary(null); setBackup(null)
    if (!file) return
    let parsed
    try { parsed = trimmed(JSON.parse(await file.text())) } catch { setError('That file is not a backup'); setBackup({}); return }
    setBackup(parsed)
    try { setSummary((await post({ backup: parsed, preview: true })).summary) } catch (e) { setError(e.message) }
  }

  const restore = async (mode) => {
    setBusy(true); setError('')
    try {
      await post({ backup, mode })
      // The screens read this device's copy of the station: dropped, it is fetched afresh on reload.
      await clearLocalData(stationId).catch(() => {})
      window.location.reload()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const close = () => { if (!busy) { setBackup(null); setSummary(null); setError('') } }
  const counts = summary && Object.entries(ENTRY_NAMES).filter(([t]) => summary.backup[t]).map(([t, n]) => `${summary.backup[t]} ${n}`)

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
        onChange={(e) => { choose(e.target.files?.[0] || null); e.target.value = '' }} />

      <Modal open={!!backup} onClose={close} title="Restore backup?">
        <div className="space-y-4">
          {!summary && !error ? (
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
            {summary ? (
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
    </>,
    document.body,
  )
})

export default RestoreBackup
