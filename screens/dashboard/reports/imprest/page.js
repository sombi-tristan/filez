'use client'

import { Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from '@/lib/nav'
import { Loader2, Plus, Trash2, Pencil, Download, FileImage, X, Camera, Search, Lock } from 'lucide-react'
import { useSubscription } from '@/lib/hooks/useSubscription'
import DateInput from '@/components/DateInput'
import { isRainoilGroup } from '@/lib/exportGroup'
import AccessGate from '@/components/AccessGate'
import { fmtDate } from '@/lib/formatDate'
import { ENTRY_INPUT, ENTRY_DATE, BTN_PRIMARY, BTN_FRAMED, CARD_LINE, CARD, INPUT_BASE } from '@/components/ui'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function ImprestPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <ImprestContent />
    </Suspense>
  )
}

function ImprestContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''
  const { subscribed: isSubscribed, loading: subLoading } = useSubscription(orgId, 'fuel-operations')
  const subBlocked = !subLoading && !isSubscribed

  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  // Period state
  const [period, setPeriod] = useState(null)
  const [loadingPeriod, setLoadingPeriod] = useState(true)
  const [imprestAmount, setImprestAmount] = useState('')
  const [custodianName, setCustodianName] = useState('')
  const [formNumber, setFormNumber] = useState('')
  const [preparedBy, setPreparedBy] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [savingPeriod, setSavingPeriod] = useState(false)

  // Entries state
  const [entries, setEntries] = useState([])
  const [loadingEntries, setLoadingEntries] = useState(false)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formDate, setFormDate] = useState('')
  const [formBeneficiary, setFormBeneficiary] = useState('')
  const [formDetails, setFormDetails] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formAccountCode, setFormAccountCode] = useState('')
  const [formPcv, setFormPcv] = useState('')
  const [formImageUrl, setFormImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  // Beneficiary search
  const [customers, setCustomers] = useState([])
  const [beneficiaryQuery, setBeneficiaryQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestionsRef = useRef(null)

  // Station name (for export)
  const [stationName, setStationName] = useState('')
  // Selects the export format, via isRainoilGroup in lib/exportGroup.
  const [stationGroup, setStationGroup] = useState('')

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Load customers once + station name
  useEffect(() => {
    if (!orgId) return
    fetch(`/api/entries/customers?org_id=${orgId}`)
      .then(r => r.json())
      .then(d => setCustomers(d.customers || []))
      .catch(() => {})
    // By id, not the list form: that one returns only owned and member stations, so an admin
    // got no station name at all. By id routes through hasStationAccess, which admits them,
    // and carries the group the export format is chosen from.
    fetch(`/api/organizations?org_id=${encodeURIComponent(orgId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const match = (data?.stations || [])[0]
        if (!match) return
        setStationName(match.name || '')
        setStationGroup(match.station_group || '')
      }).catch(() => {})
  }, [orgId])

  // Load period when month/year changes
  const loadPeriod = useCallback(async () => {
    if (!orgId) { setLoadingPeriod(false); return }
    setLoadingPeriod(true)
    try {
      const res = await fetch(`/api/entries/imprest?org_id=${orgId}&month=${month}&year=${year}`)
      const data = await res.json()
      if (data.period) {
        setPeriod(data.period)
        setImprestAmount(String(data.period.imprest_amount || ''))
        setCustodianName(data.period.custodian_name || '')
        setFormNumber(data.period.form_number || '')
      } else {
        setPeriod(null)
        setImprestAmount('')
        setCustodianName('')
        setFormNumber('')
      }
    } catch {
      setPeriod(null)
    }
    setLoadingPeriod(false)
  }, [orgId, month, year])

  useEffect(() => { loadPeriod() }, [loadPeriod])

  // Load entries when period changes
  const loadEntries = useCallback(async () => {
    if (!period?.id) { setEntries([]); return }
    setLoadingEntries(true)
    try {
      const res = await fetch(`/api/entries/imprest/entries?org_id=${orgId}&period_id=${period.id}&limit=100`)
      const data = await res.json()
      setEntries(data.entries || [])
    } catch {
      setEntries([])
    }
    setLoadingEntries(false)
  }, [period?.id])

  useEffect(() => { loadEntries() }, [loadEntries])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filtered suggestions
  const filteredCustomers = useMemo(() => {
    if (!beneficiaryQuery.trim()) return customers.slice(0, 10)
    const q = beneficiaryQuery.toLowerCase()
    return customers.filter(c => c.name.toLowerCase().includes(q)).slice(0, 10)
  }, [beneficiaryQuery, customers])

  // Save/create period
  const handleSavePeriod = async () => {
    if (!imprestAmount) return
    setSavingPeriod(true)
    try {
      const res = await fetch(`/api/entries/imprest?org_id=${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, imprest_amount: imprestAmount, custodian_name: custodianName, form_number: formNumber }),
      })
      const data = await res.json()
      if (data.period) {
        setPeriod(data.period)
      }
    } catch {}
    setSavingPeriod(false)
  }

  // Reset form
  const resetForm = () => {
    setEditingId(null)
    setFormDate('')
    setFormBeneficiary('')
    setBeneficiaryQuery('')
    setFormDetails('')
    setFormAmount('')
    setFormAccountCode('')
    setFormPcv('')
    setFormImageUrl('')
    setShowForm(false)
  }

  // Edit entry
  const startEdit = (entry) => {
    setEditingId(entry.id)
    setFormDate(entry.entry_date)
    setFormBeneficiary(entry.beneficiary)
    setBeneficiaryQuery(entry.beneficiary)
    setFormDetails(entry.transaction_details || '')
    setFormAmount(String(entry.amount || ''))
    setFormAccountCode(entry.account_code || '')
    setFormPcv(entry.pcv_number || '')
    setFormImageUrl(entry.receipt_image_url || '')
    setShowForm(true)
  }

  // Upload image
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { optimizeImage } = await import('@/lib/optimizeImage')
      const optimized = await optimizeImage(file)
      const fd = new FormData()
      fd.append('file', optimized)
      const res = await fetch('/api/entries/imprest/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) setFormImageUrl(data.url)
      else alert(data.error || 'Upload failed')
    } catch {
      alert('Upload failed')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Save entry
  const handleSaveEntry = async () => {
    if (!formDate || !formBeneficiary.trim() || !formAmount) return
    if (!period?.id) return
    setSaving(true)
    try {
      if (editingId) {
        // Update
        const res = await fetch(`/api/entries/imprest/entries/${editingId}?org_id=${orgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_date: formDate,
            beneficiary: formBeneficiary,
            transaction_details: formDetails,
            amount: formAmount,
            account_code: formAccountCode,
            pcv_number: formPcv,
            receipt_image_url: formImageUrl,
          }),
        })
        if (res.ok) { resetForm(); await loadEntries() }
      } else {
        // Create
        const res = await fetch(`/api/entries/imprest/entries?org_id=${orgId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imprest_period_id: period.id,
            entry_date: formDate,
            beneficiary: formBeneficiary,
            transaction_details: formDetails,
            amount: formAmount,
            account_code: formAccountCode,
            pcv_number: formPcv,
            receipt_image_url: formImageUrl,
          }),
        })
        if (res.ok) { resetForm(); await loadEntries() }
      }
    } catch {}
    setSaving(false)
  }

  // Delete entry
  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return
    try {
      await fetch(`/api/entries/imprest/entries/${id}?org_id=${orgId}`, { method: 'DELETE' })
      await loadEntries()
    } catch {}
  }

  // Totals
  const totalSpent = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const imprestAmt = Number(period?.imprest_amount) || 0
  const balance = imprestAmt - totalSpent

  // Excel export
  const handleExcelExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      // exportImprestExcel is a replica of Rainoil's petty cash form, theirs alone. Everyone
      // else gets the plain sheet.
      const args = {
        month, year, imprestAmount: imprestAmt, custodianName: period?.custodian_name || '',
        formNumber: period?.form_number || '', entries, totalSpent, balance,
        stationName, preparedBy, paidBy,
      }
      if (isRainoilGroup(stationGroup)) {
        const { exportImprestExcel } = await import('@/lib/exportImprestExcel')
        await exportImprestExcel(args)
      } else {
        const { exportImprestGenericExcel } = await import('@/lib/exportImprestGenericExcel')
        await exportImprestGenericExcel(args)
      }
    } catch (err) {
      console.error('Excel export failed:', err)
      alert('Export failed')
    }
    setExporting(false)
  }

  // PDF export
  const handlePdfExport = async () => {
    if (exportingPdf) return
    const withImages = entries.filter(e => e.receipt_image_url)
    if (!withImages.length) { alert('No receipt images to export'); return }
    setExportingPdf(true)
    try {
      const { exportImprestReceiptsPdf } = await import('@/lib/exportImprestReceiptsPdf')
      await exportImprestReceiptsPdf({ entries: withImages, month, year })
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('PDF export failed')
    }
    setExportingPdf(false)
  }

  if (!orgId) {
    return <div className="text-center py-20 text-content-faint">No station selected</div>
  }

  return (
    <AccessGate orgId={orgId} pageKey="imprest">
      {({ isOwner }) => (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-content">Imprest / Petty Cash</h1>
        {period && (
          <div className="flex items-center gap-2">
            <button onClick={() => { resetForm(); setShowForm(true) }} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${BTN_PRIMARY}`}>
              <Plus className="w-4 h-4" /> Add Entry
            </button>
            {isOwner && (
            <button onClick={handleExcelExport} disabled={exporting || !entries.length} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium disabled:opacity-40 ${BTN_FRAMED}`}>
              <Download className="w-4 h-4" /> {exporting ? 'Exporting...' : 'Excel'}
            </button>
            )}
            {isOwner && (
            <button onClick={handlePdfExport} disabled={exportingPdf || !entries.length} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium disabled:opacity-40 ${BTN_FRAMED}`}>
              <FileImage className="w-4 h-4" /> {exportingPdf ? 'Exporting...' : 'Receipts PDF'}
            </button>
            )}
          </div>
        )}
      </div>

      {subBlocked && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-4 py-3 mb-4 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">Subscribe to add entries</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">You can view existing data, but creating new entries requires an active subscription.</p>
          </div>
          <a href="/dashboard/subscribe" className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium ${BTN_PRIMARY}`}>Subscribe</a>
        </div>
      )}

      {/* Month / Year selector */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className={`${INPUT_BASE}`}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} min={2020} max={2099} className={`w-24 ${INPUT_BASE}`} />
      </div>

      {loadingPeriod ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-content-faint" /></div>
      ) : (
        <>
          {/* Period setup */}
          <div className={`divide-y divide-line mb-6 ${CARD}`}>
            <div className="px-3 py-1.5 bg-subtle">
              <span className="text-xs font-medium text-content-muted">Period Settings</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-line">
              <div>
                <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Imprest Amount (₦)</label>
                <input type="number" value={imprestAmount} onChange={e => setImprestAmount(e.target.value)} placeholder="e.g. 130000" className={ENTRY_INPUT} />
              </div>
              <div>
                <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Custodian Name</label>
                <input type="text" value={custodianName} onChange={e => setCustodianName(e.target.value)} placeholder="Petty cash custodian" className={ENTRY_INPUT} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-line">
              <div>
                <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Form Number</label>
                <input type="text" value={formNumber} onChange={e => setFormNumber(e.target.value)} placeholder="Optional" className={ENTRY_INPUT} />
              </div>
              <div>
                <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Prepared By</label>
                <input type="text" value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="Name of preparer" className={ENTRY_INPUT} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Paid By (Approver)</label>
              <input type="text" value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Manager / approver name" className={ENTRY_INPUT} />
            </div>
            <div className="px-3 py-2.5">
              <button onClick={handleSavePeriod} disabled={savingPeriod || !imprestAmount || subBlocked} className={`px-4 py-2 text-sm font-medium disabled:opacity-40 ${BTN_PRIMARY}`}>
                {savingPeriod ? 'Saving...' : period ? 'Update Period' : 'Create Period'}
              </button>
            </div>
          </div>

          {/* Summary */}
          {period && (
            <div className={`divide-y divide-line mb-6 ${CARD}`}>
              <div className="grid grid-cols-3 divide-x divide-line">
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-content-faint uppercase tracking-wide">Imprest</p>
                  <p className="text-lg font-bold text-content mt-1">₦{fmt(imprestAmt)}</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-content-faint uppercase tracking-wide">Total Spent</p>
                  <p className="text-lg font-bold text-orange-700 mt-1">₦{fmt(totalSpent)}</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-xs text-content-faint uppercase tracking-wide">Balance</p>
                  <p className={`text-lg font-bold mt-1 ${balance >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>₦{fmt(balance)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Entry form */}
          {showForm && period && (
            <div className={`divide-y divide-line mb-6 ${CARD}`}>
              <div className="flex items-center justify-between px-3 py-1.5 bg-subtle">
                <span className="text-xs font-medium text-content-muted">{editingId ? 'Edit Entry' : 'New Entry'}</span>
                <button onClick={resetForm} className="text-content-faint hover:text-content-muted"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-line">
                <div>
                  <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Date</label>
                  <DateInput value={formDate} onChange={setFormDate} className={ENTRY_DATE} />
                </div>
                <div className="relative" ref={suggestionsRef}>
                  <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Beneficiary</label>
                  <div className="flex items-center px-3 py-2.5">
                    <Search className="w-3.5 h-3.5 text-content-faint mr-2 flex-shrink-0" />
                    <input
                      type="text"
                      value={beneficiaryQuery}
                      onChange={e => { setBeneficiaryQuery(e.target.value); setFormBeneficiary(e.target.value); setShowSuggestions(true) }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Search accounts..."
                      className="w-full text-base bg-transparent focus:outline-none"
                    />
                  </div>
                  {showSuggestions && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 mt-0 left-0 right-0 bg-surface border border-line shadow-lg max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <button key={c.id} type="button" onClick={() => { setFormBeneficiary(c.name); setBeneficiaryQuery(c.name); setShowSuggestions(false) }} className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 dark:hover:bg-primary-950/40 border-b border-line last:border-0">
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Transaction Details</label>
                <input type="text" value={formDetails} onChange={e => setFormDetails(e.target.value)} placeholder="What was the expense for?" className={ENTRY_INPUT} />
              </div>
              <div className="grid grid-cols-2 divide-x divide-line">
                <div>
                  <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Amount (₦)</label>
                  <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0" className={ENTRY_INPUT} />
                </div>
                <div>
                  <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Account Code</label>
                  <input type="text" value={formAccountCode} onChange={e => setFormAccountCode(e.target.value)} placeholder="Optional" className={ENTRY_INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-line">
                <div>
                  <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">PCV Number</label>
                  <input type="text" value={formPcv} onChange={e => setFormPcv(e.target.value)} placeholder="Optional" className={ENTRY_INPUT} />
                </div>
                <div>
                  <label className="block text-xs text-content-faint px-2 pt-1 uppercase tracking-wide">Receipt Image</label>
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-40 ${BTN_FRAMED}`}>
                      <Camera className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                    {formImageUrl && (
                      <a href={formImageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 underline truncate max-w-[120px]">View</a>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
                  </div>
                </div>
              </div>
              <div className="px-3 py-2.5 flex items-center gap-2">
                <button onClick={handleSaveEntry} disabled={saving || !formDate || !formBeneficiary.trim() || !formAmount || subBlocked} className={`px-4 py-2 text-sm font-medium disabled:opacity-40 ${BTN_PRIMARY}`}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Add'}
                </button>
                <button onClick={resetForm} className={`px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}>Cancel</button>
              </div>
            </div>
          )}

          {/* Entries */}
          {period && (
            loadingEntries ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-content-faint" /></div>
            ) : entries.length === 0 ? (
              <div className="text-center py-10 text-content-faint text-sm">No entries yet for {MONTHS[month - 1]} {year}</div>
            ) : (
              <div className="space-y-3">
                {entries.map((e, i) => (
                  <div key={e.id} className={`divide-y divide-line ${CARD}`}>
                    <div className="flex items-center justify-between px-3 py-2 bg-subtle">
                      <span className="text-sm font-medium text-content-muted">#{i + 1} · {fmtDate(e.entry_date)}</span>
                      <div className="flex items-center gap-1">
                        {e.receipt_image_url && (
                          <a href={e.receipt_image_url} target="_blank" rel="noopener noreferrer" className="p-2 text-content-faint hover:text-primary-600"><FileImage className="w-5 h-5" /></a>
                        )}
                        <button onClick={() => startEdit(e)} className="p-2 text-content-faint hover:text-primary-600"><Pencil className="w-5 h-5" /></button>
                        <button onClick={() => handleDelete(e.id)} className="p-2 text-content-faint hover:text-red-600 dark:text-red-400"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-sm font-medium text-content">{e.beneficiary}</p>
                      {e.transaction_details && <p className="text-sm text-content-muted mt-0.5">{e.transaction_details}</p>}
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xs text-content-faint uppercase tracking-wide">Amount</p>
                      <p className="text-base font-bold text-content mt-0.5">₦{fmt(e.amount)}</p>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div className={`bg-subtle px-3 py-2.5 flex items-center justify-between ${CARD_LINE}`}>
                  <span className="text-sm font-bold text-content-strong">Total</span>
                  <span className="text-base font-bold text-content">₦{fmt(totalSpent)}</span>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
      )}
    </AccessGate>
  )
}
