'use client'

import { useState, useEffect } from 'react'
import Link from '@/lib/nav'
import { Loader2, Check, X, Eye, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { fmtDate, fmtDateShort } from '@/lib/formatDate'
import { INPUT, BTN_DANGER } from '@/components/ui'

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending_approval')
  const [expandedId, setExpandedId] = useState(null)
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(null)
  // Accounts that have signed up but are not verified yet. Nothing runs when someone
  // registers (signUp happens client-side, so there is no server hook to notify from), which
  // is how a signup sat unnoticed. This puts the count where an admin already looks.
  const [unverified, setUnverified] = useState(0)

  const loadSubs = async () => {
    const res = await fetch(`/api/admin/subscriptions?status=${filter}`)
    if (res.ok) {
      const data = await res.json()
      setSubs(data.subscriptions || [])
    }
    setLoading(false)
  }

  // Counted from the admin users list rather than a new endpoint: it already returns
  // email_verified for every account, and one more route for a number would be a second place
  // for the definition of "waiting" to drift.
  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => (r.ok ? r.json() : null))
      // The route returns a bare array, not { users }. Both shapes are handled so this
      // does not silently read zero if that ever changes.
      .then((d) => {
        const list = Array.isArray(d) ? d : (d?.users || [])
        setUnverified(list.filter((u) => !u.email_verified).length)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    loadSubs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const handleAction = async (sub, action) => {
    setActing(sub.id)
    const res = await fetch('/api/admin/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sub.id, action, notes }),
    })
    if (res.ok) {
      setActing(null)
      setExpandedId(null)
      setNotes('')
      loadSubs()
    } else {
      setActing(null)
    }
  }

  return (
    <div className="max-w-3xl">

      {/* Only when there are any: a permanent "0 waiting" line is furniture people stop
          seeing, which is the failure this is meant to prevent. */}
      {unverified > 0 && (
        <Link
          href="/admin/users?filter=unverified"
          className="flex items-center gap-2.5 px-4 py-3 mb-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-700 transition-colors"
        >
          <UserPlus className="w-4 h-4 text-amber-600 dark:text-amber-300 shrink-0" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold">{unverified}</span>{' '}
            {unverified === 1 ? 'account is' : 'accounts are'} waiting to be verified.
          </p>
          <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 underline shrink-0">Review</span>
        </Link>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-line overflow-x-auto">
        {[
          { key: 'pending_approval', label: 'Pending Approval' },
          { key: 'pending_payment', label: 'Pending Payment' },
          { key: 'approved', label: 'Approved' },
          { key: 'expired', label: 'Expired' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              filter === f.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-content-muted hover:text-content-strong'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
        </div>
      ) : subs.length === 0 ? (
        <p className="text-sm text-content-muted py-8 text-center">No subscriptions found.</p>
      ) : (
        <div className="divide-y divide-line">
          {subs.map((sub) => (
            <div key={sub.id} className="py-3">
              <div
                className="flex items-center gap-3 cursor-pointer hover:bg-subtle -mx-4 px-4 py-2 transition-colors"
                onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-content truncate">{sub.users?.name}</p>
                  <p className="text-xs text-content-muted">{sub.users?.email}</p>
                </div>
                <SubscriptionBadge status={sub.status} />
                <span className="text-xs text-content-faint">{fmtDateShort(sub.created_at)}</span>
                {expandedId === sub.id ? (
                  <ChevronUp className="w-4 h-4 text-content-faint" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-content-faint" />
                )}
              </div>

              {expandedId === sub.id && (
                <div className="mt-2 ml-0 space-y-3 px-4 pb-2">
                  <div className="space-y-1 text-sm">
                    {sub.reference_code && (
                      <div className="flex gap-2">
                        <span className="text-content-muted">Ref Code:</span>
                        <span className="text-content font-mono font-medium">{sub.reference_code}</span>
                      </div>
                    )}
                    {sub.payment_reference && (
                      <div className="flex gap-2">
                        <span className="text-content-muted">Payment Ref:</span>
                        <span className="text-content font-mono">{sub.payment_reference}</span>
                      </div>
                    )}
                    {sub.users?.phone && (
                      <div className="flex gap-2">
                        <span className="text-content-muted">Phone:</span>
                        <span className="text-content">{sub.users.phone}</span>
                      </div>
                    )}
                    {sub.payment_deadline && sub.status === 'pending_payment' && (
                      <div className="flex gap-2">
                        <span className="text-content-muted">Deadline:</span>
                        <span className="text-content">{fmtDate(sub.payment_deadline)}</span>
                      </div>
                    )}
                    {sub.start_date && (
                      <div className="flex gap-2">
                        <span className="text-content-muted">Period:</span>
                        <span className="text-content">
                          {fmtDateShort(sub.start_date)} — {fmtDate(sub.end_date)}
                        </span>
                      </div>
                    )}
                    {sub.notes && (
                      <div className="flex gap-2">
                        <span className="text-content-muted">Notes:</span>
                        <span className="text-content">{sub.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Selected services */}
                  {sub.subscription_items?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-content-muted text-sm">Services:</span>
                      {sub.subscription_items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm ml-2">
                          <span className="text-content-strong">{item.service_name}</span>
                          <span className="text-content font-mono">
                            {Number(item.price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                          </span>
                        </div>
                      ))}
                      {sub.total_amount != null && (
                        <div className="flex justify-between text-sm font-medium pt-1 border-t border-line ml-2">
                          <span className="text-content-strong">Total{sub.plan_type === 'recurring' ? '/month' : ''}</span>
                          <span className="text-content">
                            {Number(sub.total_amount).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {sub.proof_url && sub.proof_url.startsWith('https://') && (
                    <a
                      href={sub.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
                    >
                      <Eye className="w-4 h-4" /> View proof
                    </a>
                  )}

                  {sub.status === 'pending_approval' && (
                    <div className="space-y-2 pt-2 border-t border-line">
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className={INPUT}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(sub, 'approve')}
                          disabled={acting === sub.id}
                          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {acting === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(sub, 'reject')}
                          disabled={acting === sub.id}
                          className={`flex items-center gap-1 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_DANGER}`}
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
