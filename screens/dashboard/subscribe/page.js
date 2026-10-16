'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from '@/lib/nav'
import { Loader2, ShoppingCart, ArrowRight, Fuel, Calendar, Clock } from 'lucide-react'
import { differenceInDays } from 'date-fns'
import SearchableSelect from '@/components/SearchableSelect'
import SubscriptionBadge from '@/components/SubscriptionBadge'
import { fmtDate } from '@/lib/formatDate'
import { INPUT_BASE, BTN_PRIMARY, CARD } from '@/components/ui'

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-content-faint" /></div>}>
      <SubscribeContent />
    </Suspense>
  )
}

function SubscribeContent() {
  const [services, setServices] = useState([])
  const [stations, setStations] = useState([])
  const [selectedStation, setSelectedStation] = useState('')
  const [selectedItems, setSelectedItems] = useState({})
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState('1')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [subscription, setSubscription] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialOrgId = searchParams.get('org_id') || ''

  useEffect(() => {
    const load = async () => {
      const url = initialOrgId
        ? `/api/dashboard/data?org_id=${initialOrgId}`
        : '/api/dashboard/data'
      const res = await fetch(url)
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json()
      setServices(data.services || [])
      setStations(data.stations || [])
      setSubscription(data.subscription || null)

      // Pre-select station from URL param or first station
      const orgId = initialOrgId || data.stations?.[0]?.id || ''
      setSelectedStation(orgId)

      // If there's already a pending_payment subscription for this station, redirect to its pay page
      if (data.subscription?.status === 'pending_payment') {
        router.replace(`/dashboard/subscribe/pay/${data.subscription.id}`)
        return
      }

      setLoading(false)
    }
    load()
  }, [router, initialOrgId])

  // When station changes, re-fetch subscription for that station
  const handleStationChange = async (orgId) => {
    setSelectedStation(orgId)
    setSubscription(null)
    setError('')

    if (!orgId) return

    const res = await fetch(`/api/dashboard/data?org_id=${orgId}`)
    if (!res.ok) return
    const data = await res.json()
    setSubscription(data.subscription || null)

    if (data.subscription?.status === 'pending_payment') {
      router.replace(`/dashboard/subscribe/pay/${data.subscription.id}`)
    }
  }

  const toggleItem = (serviceId) => {
    setSelectedItems((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }))
  }

  const selectedServices = services.filter((s) => selectedItems[s.id])
  const monthlyTotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0)
  const monthsNum = Math.max(1, Math.min(24, parseInt(months) || 1))
  const total = monthlyTotal * monthsNum

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedStation) {
      setError('Please select a station')
      return
    }
    if (selectedServices.length === 0) {
      setError('Please select at least one service')
      return
    }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_id: selectedStation,
        months: monthsNum,
        total_amount: total,
        items: selectedServices.map((s) => ({
          service_id: s.id,
          service_name: s.name,
          price: Number(s.price),
        })),
      }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      if (res.status === 409 && data.existingId) {
        router.push(`/dashboard/subscribe/pay/${data.existingId}`)
        return
      }
      setError(data.error || 'Failed to create subscription')
      return
    }

    router.push(`/dashboard/subscribe/pay/${data.subscription.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  // Show active subscription info
  const daysLeft = subscription?.end_date
    ? differenceInDays(new Date(subscription.end_date), new Date())
    : null
  const hasApproved = subscription?.status === 'approved'
  const hasPendingApproval = subscription?.status === 'pending_approval'

  return (
    <div className="max-w-lg px-4 sm:px-8 py-8">
      <p className="text-sm text-content-muted mb-8">
        Select your station and services to get started. You&apos;ll pay via bank transfer next.
      </p>

      {/* Station selector */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-3 flex items-center gap-2">
          <Fuel className="w-4 h-4" /> Station
        </h2>
        {stations.length === 0 ? (
          <p className="text-sm text-content-muted">You don&apos;t own any stations yet.</p>
        ) : stations.length === 1 ? (
          <div className="border border-primary-500/40 bg-primary-50 dark:bg-primary-950/40 p-3 text-sm font-medium text-content">
            {stations[0].name}
          </div>
        ) : (
          <div className={`${CARD}`}>
            <SearchableSelect
              value={selectedStation}
              onChange={(val) => handleStationChange(val)}
              options={stations.map((st) => ({ value: st.id, label: st.name }))}
              placeholder="Select a station..."
            />
          </div>
        )}
      </div>

      {/* Current subscription for the selected station. This block used to sit at the foot of
          the station hub; it belongs on the page the Subscription button now opens.
          No "Subscribe now" call to action, unlike the hub's version: the form below IS that
          action. No pending_payment branch either, because that status redirects to the pay
          page above before this renders. */}
      {subscription && (
        <section className={`p-4 mb-6 ${CARD}`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-content uppercase tracking-wide">Current subscription</h2>
            <SubscriptionBadge status={subscription.status} />
          </div>
          {hasApproved ? (
            <div className="flex items-center gap-2 text-sm text-content-muted">
              <Clock className="w-4 h-4" />
              Expires {fmtDate(subscription.end_date)}
              {daysLeft !== null && daysLeft <= 7 && (
                <span className="text-orange-500 dark:text-orange-300 font-medium">({daysLeft} days left)</span>
              )}
            </div>
          ) : hasPendingApproval ? (
            <p className="text-sm text-content-muted">
              Your payment proof is being reviewed. You&apos;ll be notified once approved.
            </p>
          ) : (
            <p className="text-sm text-content-muted">
              {subscription.status === 'expired' ? 'Your subscription has expired.' :
               subscription.status === 'rejected' ? 'Your subscription was rejected.' :
               'You don\'t have an active subscription.'}
            </p>
          )}
        </section>
      )}

      {services.length === 0 ? (
        <p className="text-sm text-content-muted py-8 text-center">No services available yet.</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-4 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Select Services
            </h2>
            <div className="space-y-2">
              {services.map((svc) => (
                <label
                  key={svc.id}
                  className={`flex items-start gap-3 border p-3 cursor-pointer transition-colors ${
                    selectedItems[svc.id] ? 'border-blue-600 bg-primary-50 dark:bg-primary-950/40' : 'border-line hover:border-line'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!selectedItems[svc.id]}
                    onChange={() => toggleItem(svc.id)}
                    className="mt-0.5 border-line text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content">{svc.name}</p>
                    {svc.description && <p className="text-xs text-content-muted mt-0.5">{svc.description}</p>}
                  </div>
                  <span className="text-sm font-semibold text-content whitespace-nowrap">
                    {Number(svc.price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                  </span>
                </label>
              ))}
            </div>

            {selectedServices.length > 0 && (
              <>
                {/* Duration */}
                <div className="mt-6">
                  <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Duration
                  </h2>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={months}
                      onChange={(e) => setMonths(e.target.value)}
                      onBlur={() => setMonths(String(monthsNum))}
                      className={`w-20 text-center font-medium ${INPUT_BASE}`}
                    />
                    <span className="text-sm text-content-muted">month{monthsNum !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-line">
                  <div>
                    <span className="text-sm font-medium text-content-strong">Total</span>
                    {monthsNum > 1 && (
                      <span className="text-xs text-content-faint ml-2">
                        ({monthlyTotal.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })} × {monthsNum} months)
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-content">
                    {total.toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                  </span>
                </div>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting || selectedServices.length === 0 || !selectedStation}
            className={`w-full py-2.5 font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${BTN_PRIMARY}`}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Continue to payment
          </button>
        </form>
      )}
    </div>
  )
}
