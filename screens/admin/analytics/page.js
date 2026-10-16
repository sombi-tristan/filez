'use client'

import { useState, useEffect } from 'react'
import { Loader2, Users, CreditCard, TrendingUp, Star } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { subMonths, startOfMonth, format } from 'date-fns'
import { fmtDateShort } from '@/lib/formatDate'
import { CARD } from '@/components/ui'

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [monthlyData, setMonthlyData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [usersRes, activeSubs, pendingSubs, expiredSubs, feedbackRes, allSubs] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'user'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).in('status', ['pending_payment', 'pending_approval']),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
        supabase.from('feedback').select('*, users(name)').order('submitted_at', { ascending: false }).limit(10),
        supabase.from('subscriptions').select('created_at, status').eq('status', 'approved'),
      ])

      setStats({
        totalUsers: usersRes.count || 0,
        activeSubs: activeSubs.count || 0,
        pendingSubs: pendingSubs.count || 0,
        expiredSubs: expiredSubs.count || 0,
      })

      setFeedback(feedbackRes.data || [])

      // Build monthly chart data (last 6 months)
      const months = []
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(new Date(), i))
        const label = format(monthStart, 'MMM')
        const count = (allSubs.data || []).filter((s) => {
          const d = new Date(s.created_at)
          return d.getMonth() === monthStart.getMonth() && d.getFullYear() === monthStart.getFullYear()
        }).length
        months.push({ month: label, subscriptions: count })
      }
      setMonthlyData(months)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary-600' },
          { label: 'Active Subs', value: stats.activeSubs, icon: CreditCard, color: 'text-green-600 dark:text-green-400' },
          { label: 'Pending', value: stats.pendingSubs, icon: TrendingUp, color: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Expired', value: stats.expiredSubs, icon: CreditCard, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`p-4 ${CARD}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-content-muted">{label}</span>
            </div>
            <p className="text-2xl font-bold text-content">{value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="border-t border-line pt-6 mb-8">
        <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-4">Monthly Active Subscriptions</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="subscriptions" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent feedback */}
      <div className="border-t border-line pt-6">
        <h2 className="text-sm font-semibold text-content uppercase tracking-wide mb-4">Recent Feedback</h2>

        {feedback.length === 0 ? (
          <p className="text-sm text-content-muted">No feedback yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {feedback.map((fb) => (
              <div key={fb.id} className="py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-content">{fb.users?.name || 'User'}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-3 h-3 ${n <= fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-content-faint'}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-content-faint">{fmtDateShort(fb.submitted_at)}</span>
                </div>
                <p className="text-sm text-content-muted">{fb.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
