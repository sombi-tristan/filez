'use client'

import { Suspense, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from '@/lib/nav'
import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  checkmarkCircleOutline, createOutline, ellipseOutline, ellipsisHorizontal, peopleOutline,
  personAddOutline, readerOutline, trashOutline,
} from 'ionicons/icons'
import {
  BottomSheet, Button, ConfirmDialog, Dialog, EmptyState, IconButton, Pager, SheetAction, Stat, StatGrid,
} from '@/design'
import { db } from '@/lib/db'
import { DEFAULT_PHONE } from '@/lib/defaultAccounts'
import DateInput from '@/components/DateInput'
import SearchableSelect from '@/components/SearchableSelect'
import AccessGate from '@/components/AccessGate'
import { fmtDate } from '@/lib/formatDate'
import { REPORT_HEAD, REPORT_LINE, REPORT_RULE, REPORT_TOTAL_FILL, OUTLINE_WITHIN, INPUT, BTN_PRIMARY, CARD_LINE, REPORT_CARD } from '@/components/ui'

function fmt(n) {
  if (n == null || isNaN(n)) return ''
  return Number(n).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtBal(n) {
  if (n == null || isNaN(n)) return ''
  const v = Number(n)
  if (v < 0) return `(${fmt(Math.abs(v))})`
  return fmt(v)
}

const PAGE_SIZE = 15

export default function AccountLedgerPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <AccountLedgerContent />
    </Suspense>
  )
}

function AccountLedgerContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('org_id') || ''

  const today = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const monthStartStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`

  const [startDate, setStartDate] = useState(monthStartStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [page, setPage] = useState(0)

  // Account form (shared for create and edit)
  const [formMode, setFormMode] = useState(null) // null | 'create' | 'edit'
  const [formId, setFormId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formBalance, setFormBalance] = useState('')
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState('')
  // The account whose actions sheet is open, and the one waiting on "Delete?".
  const [actionsId, setActionsId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  // Live data from IndexedDB
  const customers = useLiveQuery(
    () => orgId ? db.customers.where('orgId').equals(orgId).toArray() : [],
    [orgId], []
  )
  const allPayments = useLiveQuery(
    () => orgId ? db.customerPayments.where('orgId').equals(orgId).toArray() : [],
    [orgId], []
  )

  // Filter out default/system accounts
  const creditCustomers = useMemo(
    () => customers.filter(c => c.phone !== DEFAULT_PHONE).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [customers]
  )

  // Account selector options
  const accountOptions = useMemo(() => [
    { value: '__all__', label: 'All Accounts' },
    ...creditCustomers.map(c => ({ value: c.id, label: c.name || 'Unnamed' })),
  ], [creditCustomers])

  // Labels for selected accounts
  const selectedLabels = useMemo(() => {
    return selectedAccounts.map(id => {
      const c = creditCustomers.find(c => c.id === id)
      return { id, name: c?.name || 'Unnamed' }
    })
  }, [selectedAccounts, creditCustomers])

  // Build ledger data for ALL accounts (needed for "All" view pagination)
  const allLedgerData = useMemo(() => {
    if (!creditCustomers.length) return []

    return creditCustomers.map(cust => {
      const custPayments = allPayments.filter(p => p.customerId === cust.id)

      const priorEntries = custPayments.filter(p => p.entryDate < startDate)
      const priorSales = priorEntries.reduce((s, p) => s + (Number(p.salesAmount) || 0), 0)
      const priorPaid = priorEntries.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0)
      const openingBalance = (Number(cust.opening_balance) || 0) + priorSales - priorPaid

      const rangeEntries = custPayments
        .filter(p => p.entryDate >= startDate && p.entryDate <= endDate)
        .sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || '') || (a.createdAt || '').localeCompare(b.createdAt || ''))

      let balance = openingBalance
      const rows = rangeEntries.map(entry => {
        const debit = Number(entry.salesAmount) || 0
        const credit = Number(entry.amountPaid) || 0
        balance += debit - credit
        return {
          id: entry.id,
          date: entry.entryDate,
          particulars: entry.notes || (debit && credit ? 'Sales & Payment' : debit ? 'Sales on credit' : credit ? 'Payment received' : ''),
          debit,
          credit,
          balance,
        }
      })

      const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
      const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
      const closingBalance = openingBalance + totalDebit - totalCredit

      return {
        id: cust.id,
        name: cust.name || 'Unnamed',
        phone: cust.phone || '',
        openingBalance,
        closingBalance,
        totalDebit,
        totalCredit,
        rows,
        station_value_tracked: Boolean(cust.station_value_tracked),
      }
    })
  }, [creditCustomers, allPayments, startDate, endDate])

  // Selected accounts data
  const selectedData = useMemo(() => {
    return selectedAccounts.map(id => allLedgerData.find(d => d.id === id)).filter(Boolean)
  }, [allLedgerData, selectedAccounts])

  // Multi-account merged journal
  const mergedJournal = useMemo(() => {
    if (selectedData.length < 2) return null
    const combinedOpening = selectedData.reduce((s, d) => s + d.openingBalance, 0)
    const allRows = selectedData.flatMap(d =>
      d.rows.map(r => ({ ...r, account: d.name }))
    ).sort((x, y) => (x.date || '').localeCompare(y.date || '') || (x.id || '').localeCompare(y.id || ''))

    let balance = combinedOpening
    const rows = allRows.map(r => {
      balance += r.debit - r.credit
      return { ...r, balance }
    })

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

    return {
      names: selectedData.map(d => d.name),
      openingBalance: combinedOpening,
      closingBalance: combinedOpening + totalDebit - totalCredit,
      totalDebit,
      totalCredit,
      rows,
    }
  }, [selectedData])

  // "All" view: sorted by most debt, paginated
  const sortedAll = useMemo(() => {
    return [...allLedgerData].sort((a, b) => b.closingBalance - a.closingBalance)
  }, [allLedgerData])

  const totalPages = Math.ceil(sortedAll.length / PAGE_SIZE)
  const pagedData = useMemo(() => {
    const start = page * PAGE_SIZE
    return sortedAll.slice(start, start + PAGE_SIZE)
  }, [sortedAll, page])

  // Grand totals (all accounts, not just current page)
  const totals = useMemo(() => {
    return allLedgerData.reduce((acc, c) => ({
      openingBalance: acc.openingBalance + c.openingBalance,
      totalDebit: acc.totalDebit + c.totalDebit,
      totalCredit: acc.totalCredit + c.totalCredit,
      closingBalance: acc.closingBalance + c.closingBalance,
    }), { openingBalance: 0, totalDebit: 0, totalCredit: 0, closingBalance: 0 })
  }, [allLedgerData])

  // Station value: aggregate only tracked accounts
  const stationValueData = useMemo(() => {
    const tracked = allLedgerData.filter(d => d.station_value_tracked)
    if (!tracked.length) return null

    const combinedOpening = tracked.reduce((s, d) => s + d.openingBalance, 0)
    const allRows = tracked.flatMap(d =>
      d.rows.map(r => ({ ...r, account: d.name }))
    ).sort((x, y) => (x.date || '').localeCompare(y.date || '') || (x.id || '').localeCompare(y.id || ''))

    let balance = combinedOpening
    const rows = allRows.map(r => {
      balance += r.debit - r.credit
      return { ...r, balance }
    })

    const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0)

    return {
      accountCount: tracked.length,
      openingBalance: combinedOpening,
      closingBalance: combinedOpening + totalDebit - totalCredit,
      totalDebit,
      totalCredit,
      rows,
    }
  }, [allLedgerData])

  // Toggle account selection (max 10)
  const handleAccountChange = useCallback((val) => {
    if (val === '__all__') {
      setSelectedAccounts([])
      setPage(0)
      return
    }
    setSelectedAccounts(prev => {
      if (prev.includes(val)) return prev.filter(id => id !== val)
      if (prev.length >= 10) return [...prev.slice(1), val]
      return [...prev, val]
    })
    setPage(0)
  }, [])

  const openCreate = () => {
    setFormMode('create')
    setFormId(null)
    setFormName('')
    setFormPhone('')
    setFormBalance('')
    setFormError('')
  }

  const openEdit = (cust) => {
    setFormMode('edit')
    setFormId(cust.id)
    setFormName(cust.name || '')
    setFormPhone(cust.phone || '')
    setFormBalance(String(cust.opening_balance ?? 0))
    setFormError('')
  }

  const closeForm = () => { setFormMode(null); setFormError('') }

  const handleSaveForm = async () => {
    const name = formName.trim()
    if (!name) { setFormError('Account name is required'); return }

    setFormSaving(true)
    setFormError('')
    try {
      if (formMode === 'create') {
        if (creditCustomers.some(c => c.name?.toLowerCase() === name.toLowerCase())) {
          setFormError('An account with this name already exists'); setFormSaving(false); return
        }
        const newCustomer = {
          id: crypto.randomUUID(), orgId, name,
          phone: formPhone.trim() || null,
          opening_balance: Number(formBalance) || 0,
          opening_date: todayStr,
          sort_order: customers.length,
          station_value_tracked: false,
        }
        await db.customers.add(newCustomer)
        fetch(`/api/entries/customers?org_id=${orgId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCustomer),
        }).then(async res => {
          if (res.ok) {
            const { customer } = await res.json()
            await db.customers.update(newCustomer.id, { id: customer.id, ...customer, orgId })
          }
        }).catch(() => {})
        setSelectedAccounts([newCustomer.id])
      } else {
        const updates = { name, phone: formPhone.trim() || null, opening_balance: Number(formBalance) || 0 }
        await db.customers.update(formId, updates)
        fetch(`/api/entries/customers?org_id=${orgId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: formId, ...updates }),
        }).catch(() => {})
      }
      closeForm()
    } catch {
      setFormError('Failed to save account')
    }
    setFormSaving(false)
  }

  // Asked first in the ConfirmDialog below, which holds while this runs.
  const handleDelete = async (acctId) => {
    await db.customers.delete(acctId)
    setSelectedAccounts(prev => prev.filter(id => id !== acctId))
    if (formId === acctId) closeForm()
    fetch(`/api/entries/customers?org_id=${orgId}&id=${acctId}`, { method: 'DELETE' }).catch(() => {})
  }

  const handleToggleTracked = async (acctId, current) => {
    const newVal = !current
    await db.customers.update(acctId, { station_value_tracked: newVal })
    fetch(`/api/entries/customers?org_id=${orgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: acctId, station_value_tracked: newVal }),
    }).catch(() => {})
  }

  if (!orgId) return <div className="p-6 text-content-muted">No station selected.</div>

  const actionsFor = actionsId ? allLedgerData.find((d) => d.id === actionsId) : null
  const deleting = deleteId ? allLedgerData.find((d) => d.id === deleteId) : null

  return (
    <AccessGate orgId={orgId} pageKey="report-account-ledger">
      {() => (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-3 pb-10">
      {/* Controls: the period and a new account on one line, the account picker under it. */}
      <div className="flex items-center gap-2 mb-3">
        <DateInput value={startDate} onChange={setStartDate} className={`flex-1 px-2 py-2.5 text-sm font-medium ${OUTLINE_WITHIN}`} />
        <span className="text-sm text-content-faint">to</span>
        <DateInput value={endDate} onChange={setEndDate} className={`flex-1 px-2 py-2.5 text-sm font-medium ${OUTLINE_WITHIN}`} />
        <IconButton icon={personAddOutline} label="New account" variant="secondary" onClick={openCreate} />
      </div>

      <div className="mb-4">
        <SearchableSelect
          value={selectedAccounts.length === 0 ? '__all__' : ''}
          onChange={handleAccountChange}
          options={accountOptions}
          placeholder="Select account..."
        />
        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedLabels.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleAccountChange(s.id)}
                className="inline-flex items-center gap-1.5 min-h-[36px] pl-3 pr-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 text-sm font-semibold"
                aria-label={`Remove ${s.name}`}
              >
                {s.name}
                <X className="w-4 h-4" />
              </button>
            ))}
            {selectedLabels.length > 1 && (
              <button type="button" onClick={() => handleAccountChange('__all__')} className="min-h-[36px] px-3 text-sm font-semibold text-content-muted">
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {creditCustomers.length === 0 && (
        <EmptyState
          icon={peopleOutline}
          title="No credit accounts yet"
          action={<Button expand="inline" icon={personAddOutline} onClick={openCreate}>New account</Button>}
        >
          Add the customers who buy on credit to follow what each one owes.
        </EmptyState>
      )}

      {/* Several accounts: one journal across them */}
      {selectedAccounts.length >= 2 && mergedJournal && (
        <LedgerView
          title={mergedJournal.names.length <= 3 ? mergedJournal.names.join(' & ') : `${mergedJournal.names.slice(0, 3).join(', ')} + ${mergedJournal.names.length - 3} more`}
          data={mergedJournal}
          startDate={startDate}
          endDate={endDate}
          withAccount
          table={<MergedJournalTable data={mergedJournal} startDate={startDate} endDate={endDate} />}
        />
      )}

      {/* One account: its journal */}
      {selectedAccounts.length === 1 && selectedData[0] && (
        <LedgerView
          title={selectedData[0].name}
          data={selectedData[0]}
          startDate={startDate}
          endDate={endDate}
          table={<JournalTable data={selectedData[0]} startDate={startDate} endDate={endDate} />}
        />
      )}

      {/* Every account: the totals, then one card per account, most owed first */}
      {selectedAccounts.length === 0 && pagedData.length > 0 && (
        <>
          <StatGrid>
            <Stat label="Opening" value={fmtBal(totals.openingBalance)} />
            <Stat label="Sales" value={fmt(totals.totalDebit) || '0'} />
            <Stat label="Payments" value={fmt(totals.totalCredit) || '0'} />
            <Stat label="Closing" value={fmtBal(totals.closingBalance)} />
          </StatGrid>

          <div className="flex items-baseline justify-between mt-5 mb-2">
            <h2 className="font-semibold text-content">All accounts</h2>
            <span className="text-[15px] text-content-muted">{sortedAll.length}</span>
          </div>

          <div className={`border-card ${CARD_LINE} rounded-house divide-y divide-line overflow-hidden`}>
            {pagedData.map(acct => (
              <div key={acct.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => handleAccountChange(acct.id)}
                  className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3 text-left hover:bg-subtle active:bg-subtle"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-content truncate">
                      {acct.name}
                      {acct.station_value_tracked && <span className="ml-2 text-[13px] font-semibold text-primary-600 dark:text-primary-300">Station value</span>}
                    </p>
                    <p className="text-[13px] text-content-muted tabular-nums">
                      Opening {fmtBal(acct.openingBalance) || '0'} · Sales {fmt(acct.totalDebit) || '0'} · Paid {fmt(acct.totalCredit) || '0'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] text-content-muted">Closing</p>
                    <p className="font-bold text-content tabular-nums">{fmtBal(acct.closingBalance) || '0'}</p>
                  </div>
                </button>
                <div className="flex items-center pr-2">
                  <IconButton icon={ellipsisHorizontal} label={`More for ${acct.name}`} variant="neutral" onClick={() => setActionsId(acct.id)} />
                </div>
              </div>
            ))}
          </div>

          <Pager page={page} pageCount={totalPages} onChange={setPage} />
        </>
      )}

      {/* Station value: the accounts tracked together */}
      {selectedAccounts.length === 0 && stationValueData && (
        <div className="mt-8">
          <LedgerView
            title="Station value"
            subtitle={`Tracking ${stationValueData.accountCount} account${stationValueData.accountCount !== 1 ? 's' : ''}`}
            data={stationValueData}
            startDate={startDate}
            endDate={endDate}
            withAccount
            labels={{ debit: 'Credit given', credit: 'Collected', balance: 'Outstanding' }}
            table={<StationValueSection data={stationValueData} startDate={startDate} endDate={endDate} />}
          />
        </div>
      )}

      {/* An account's actions, from its card */}
      <BottomSheet open={Boolean(actionsFor)} onClose={() => setActionsId(null)} label={actionsFor?.name || 'Account'}>
        {actionsFor && (
          <>
            <p className="px-4 pt-1 pb-2 font-semibold text-content">{actionsFor.name}</p>
            <SheetAction icon={readerOutline} label="Open ledger" onClick={() => { setActionsId(null); handleAccountChange(actionsFor.id) }} />
            <SheetAction
              icon={actionsFor.station_value_tracked ? checkmarkCircleOutline : ellipseOutline}
              label={actionsFor.station_value_tracked ? 'Tracked in station value' : 'Track in station value'}
              onClick={() => handleToggleTracked(actionsFor.id, actionsFor.station_value_tracked)}
            />
            <SheetAction icon={createOutline} label="Edit account" onClick={() => { setActionsId(null); openEdit(creditCustomers.find(c => c.id === actionsFor.id)) }} />
            <SheetAction icon={trashOutline} label="Delete account" tone="danger" onClick={() => { setActionsId(null); setDeleteId(actionsFor.id) }} />
          </>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => { await handleDelete(deleteId); setDeleteId(null) }}
        title={`Delete ${deleting?.name || 'this account'}?`}
        confirmLabel="Delete"
      >
        Its transaction history is kept but no longer linked to an account.
      </ConfirmDialog>

      {/* Create or edit an account */}
      <Dialog open={Boolean(formMode)} onClose={closeForm} title={formMode === 'edit' ? 'Edit account' : 'New account'} placement="bottom">
        <div className="space-y-3">
          <div>
            <label className="block text-[13px] font-semibold text-content-muted mb-1">Name</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Account name" maxLength={200} autoCapitalize="words" className={INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-content-muted mb-1">Phone</label>
              <input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="Optional" maxLength={20} className={INPUT} />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-content-muted mb-1">Opening balance</label>
              <input type="text" inputMode="decimal" value={formBalance} onChange={(e) => setFormBalance(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="0" className={INPUT} />
            </div>
          </div>
          {formError && <p className="text-[15px] font-semibold text-red-600 dark:text-red-400">{formError}</p>}
          <Button size="large" onClick={handleSaveForm} disabled={formSaving}>
            {formSaving ? 'Saving…' : 'Save account'}
          </Button>
        </div>
      </Dialog>
    </div>
      )}
    </AccessGate>
  )
}

/**
 * A journal: on a phone a card per entry (date, what it was, the amount in or out, and the
 * running balance), between the opening and closing balance; on a computer the table.
 * `withAccount` shows which account each entry belongs to, for a journal across accounts.
 */
const LEDGER_PAGE = 20

function LedgerView({ title, subtitle = null, data, startDate, endDate, withAccount = false, labels = {}, table }) {
  const [page, setPage] = useState(0)
  const words = { debit: 'Sales', credit: 'Payment', balance: 'Balance', ...labels }
  const pageCount = Math.ceil(data.rows.length / LEDGER_PAGE)
  const rows = data.rows.slice(page * LEDGER_PAGE, (page + 1) * LEDGER_PAGE)

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-bold text-content">{title}</h2>
        {subtitle && <p className="text-[15px] text-content-muted">{subtitle}</p>}
      </div>

      {/* A phone: the summary, then the entries as cards. */}
      <div className="md:hidden">
        <StatGrid>
          <Stat label={`Opening · ${fmtDate(startDate)}`} value={fmtBal(data.openingBalance) || '0'} />
          <Stat label={`Closing · ${fmtDate(endDate)}`} value={fmtBal(data.closingBalance) || '0'} />
          <Stat label={words.debit} value={fmt(data.totalDebit) || '0'} />
          <Stat label={words.credit} value={fmt(data.totalCredit) || '0'} />
        </StatGrid>

        {data.rows.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-content-muted">No transactions in this period.</p>
        ) : (
          <ol className={`mt-4 border-card ${CARD_LINE} rounded-house divide-y divide-line`}>
            {rows.map((row, i) => (
              <li key={`${row.id}-${i}`} className="flex items-start gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-content-muted">
                    {fmtDate(row.date)}
                    {withAccount && row.account ? <> · <span className="font-semibold">{row.account}</span></> : null}
                  </p>
                  <p className="text-content truncate">{row.particulars || '—'}</p>
                </div>
                <div className="text-right shrink-0 tabular-nums">
                  {row.debit ? <p className="font-semibold text-content">+{fmt(row.debit)}</p> : null}
                  {row.credit ? <p className="font-semibold text-content">−{fmt(row.credit)}</p> : null}
                  <p className="text-[13px] text-content-muted">{words.balance} {fmtBal(row.balance) || '0'}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <Pager page={page} pageCount={pageCount} onChange={setPage} />
        <p className="mt-2 text-[13px] text-content-faint">+ {words.debit.toLowerCase()} · − {words.credit.toLowerCase()} · balances in brackets are in the account&apos;s favour</p>
      </div>

      {/* A computer: the table. */}
      <div className={`hidden md:block overflow-x-auto ${REPORT_CARD}`}>{table}</div>
    </section>
  )
}

function JournalTable({ data, startDate, endDate }) {
  const cell = `border ${REPORT_LINE} px-3 py-1.5 text-sm whitespace-nowrap`
  const cellR = cell + ' text-right'
  const hdr = `${REPORT_HEAD} font-bold text-sm`

  return (
    <div>
      <table className={`w-full border-collapse border ${REPORT_LINE}`}>
        <thead>
          <tr className={hdr}>
            <th className={cell + ' text-left w-24'}>Date</th>
            <th className={cell + ' text-left'}>Particulars</th>
            <th className={cell + ' text-right w-28'}>Sales</th>
            <th className={cell + ' text-right w-28'}>Payment</th>
            <th className={cell + ' text-right w-32'}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {/* Opening balance */}
          <tr className={`${REPORT_TOTAL_FILL} font-semibold`}>
            <td className={`${cellR} whitespace-nowrap`}>{fmtDate(startDate)}</td>
            <td className={cell}>Opening Balance</td>
            <td className={cellR}></td>
            <td className={cellR}></td>
            <td className={cellR}>{fmtBal(data.openingBalance)}</td>
          </tr>

          {/* Transaction rows */}
          {data.rows.map(row => (
            <tr key={row.id}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
              <td className={cell}>{row.particulars}</td>
              <td className={cellR}>{row.debit ? fmt(row.debit) : ''}</td>
              <td className={cellR}>{row.credit ? fmt(row.credit) : ''}</td>
              <td className={cellR + ' font-medium'}>{fmtBal(row.balance)}</td>
            </tr>
          ))}

          {data.rows.length === 0 && (
            <tr>
              <td colSpan={5} className={cell + ' text-center text-content-faint italic'}>
                No transactions in this period
              </td>
            </tr>
          )}

          {/* Closing balance / totals */}
          <tr className={`${REPORT_TOTAL_FILL} font-bold ${REPORT_RULE}`}>
            <td className={`${cellR} whitespace-nowrap`}>{fmtDate(endDate)}</td>
            <td className={cell}>Closing Balance</td>
            <td className={cellR}>{data.totalDebit ? fmt(data.totalDebit) : ''}</td>
            <td className={cellR}>{data.totalCredit ? fmt(data.totalCredit) : ''}</td>
            <td className={cellR}>{fmtBal(data.closingBalance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function MergedJournalTable({ data, startDate, endDate }) {
  const [page, setPage] = useState(0)
  const cell = `border ${REPORT_LINE} px-3 py-1.5 text-sm whitespace-nowrap`
  const cellR = cell + ' text-right'
  const hdr = `${REPORT_HEAD} font-bold text-sm`

  const totalPages = Math.ceil(data.rows.length / PAGE_SIZE)
  const pagedRows = data.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>
      <table className={`w-full border-collapse border ${REPORT_LINE}`}>
        <thead>
          <tr className={hdr}>
            <th className={cell + ' text-left w-24'}>Date</th>
            <th className={cell + ' text-left'}>Account</th>
            <th className={cell + ' text-left'}>Particulars</th>
            <th className={cell + ' text-right w-28'}>Sales</th>
            <th className={cell + ' text-right w-28'}>Payment</th>
            <th className={cell + ' text-right w-32'}>Balance</th>
          </tr>
        </thead>
        <tbody>
          {page === 0 && (
            <tr className={`${REPORT_TOTAL_FILL} font-semibold`}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(startDate)}</td>
              <td className={cell}></td>
              <td className={cell}>Opening Balance</td>
              <td className={cellR}></td>
              <td className={cellR}></td>
              <td className={cellR}>{fmtBal(data.openingBalance)}</td>
            </tr>
          )}

          {pagedRows.map((row, i) => (
            <tr key={`${row.id}-${i}`}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
              <td className={cell + ' text-xs text-content-muted'}>{row.account}</td>
              <td className={cell}>{row.particulars}</td>
              <td className={cellR}>{row.debit ? fmt(row.debit) : ''}</td>
              <td className={cellR}>{row.credit ? fmt(row.credit) : ''}</td>
              <td className={cellR + ' font-medium'}>{fmtBal(row.balance)}</td>
            </tr>
          ))}

          {data.rows.length === 0 && (
            <tr>
              <td colSpan={6} className={cell + ' text-center text-content-faint italic'}>
                No transactions in this period
              </td>
            </tr>
          )}

          {page === totalPages - 1 && (
            <tr className={`${REPORT_TOTAL_FILL} font-bold ${REPORT_RULE}`}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(endDate)}</td>
              <td className={cell}></td>
              <td className={cell}>Closing Balance</td>
              <td className={cellR}>{data.totalDebit ? fmt(data.totalDebit) : ''}</td>
              <td className={cellR}>{data.totalCredit ? fmt(data.totalCredit) : ''}</td>
              <td className={cellR}>{fmtBal(data.closingBalance)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed ${BTN_PRIMARY}`}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-content-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed ${BTN_PRIMARY}`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function StationValueSection({ data, startDate, endDate }) {
  const [page, setPage] = useState(0)
  const cell = `border ${REPORT_LINE} px-3 py-1.5 text-sm whitespace-nowrap`
  const cellR = cell + ' text-right'
  const hdr = `${REPORT_HEAD} font-bold text-sm`

  const totalPages = Math.ceil(data.rows.length / PAGE_SIZE)
  const pagedRows = data.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div>

      <table className={`w-full border-collapse border ${REPORT_LINE}`}>
        <thead>
          <tr className={hdr}>
            <th className={cell + ' text-left w-24'}>Date</th>
            <th className={cell + ' text-left'}>Account</th>
            <th className={cell + ' text-left'}>Particulars</th>
            <th className={cell + ' text-right w-28'}>Credit Given</th>
            <th className={cell + ' text-right w-28'}>Collected</th>
            <th className={cell + ' text-right w-32'}>Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {page === 0 && (
            <tr className={`${REPORT_TOTAL_FILL} font-semibold`}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(startDate)}</td>
              <td className={cell}></td>
              <td className={cell}>Opening Balance</td>
              <td className={cellR}></td>
              <td className={cellR}></td>
              <td className={cellR}>{fmtBal(data.openingBalance)}</td>
            </tr>
          )}

          {pagedRows.map((row, i) => (
            <tr key={`${row.id}-${i}`}>
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(row.date)}</td>
              <td className={cell + ' text-xs text-content-muted'}>{row.account}</td>
              <td className={cell}>{row.particulars}</td>
              <td className={cellR}>{row.debit ? fmt(row.debit) : ''}</td>
              <td className={cellR}>{row.credit ? fmt(row.credit) : ''}</td>
              <td className={cellR + ' font-medium'}>{fmtBal(row.balance)}</td>
            </tr>
          ))}

          {data.rows.length === 0 && (
            <tr>
              <td colSpan={6} className={cell + ' text-center text-content-faint italic'}>
                No transactions in this period
              </td>
            </tr>
          )}

          {(totalPages <= 1 || page === totalPages - 1) && (
            <tr className="bg-green-50 dark:bg-green-950/40 font-bold border-t border-green-300">
              <td className={`${cellR} whitespace-nowrap`}>{fmtDate(endDate)}</td>
              <td className={cell}></td>
              <td className={cell}>Closing Balance</td>
              <td className={cellR}>{data.totalDebit ? fmt(data.totalDebit) : ''}</td>
              <td className={cellR}>{data.totalCredit ? fmt(data.totalCredit) : ''}</td>
              <td className={cellR}>{fmtBal(data.closingBalance)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed ${BTN_PRIMARY}`}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-content-muted">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-30 disabled:cursor-not-allowed ${BTN_PRIMARY}`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
