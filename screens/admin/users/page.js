'use client'

import { useState, useEffect } from 'react'
import { Loader2, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { fmtDate, fmtDateShort } from '@/lib/formatDate'
import { INPUT_BASE, INPUT_BARE } from '@/components/ui'

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all, verified, unverified

  // Honour ?filter= so the "accounts waiting to be verified" banner on /admin can link
  // straight to them. Read from window rather than useSearchParams: that hook would drag this
  // page into a Suspense boundary for one optional query string.
  useEffect(() => {
    try {
      const f = new URLSearchParams(window.location.search).get('filter')
      if (f === 'verified' || f === 'unverified' || f === 'all') setFilter(f)
    } catch { /* ignore */ }
  }, [])
  const [selectedUser, setSelectedUser] = useState(null)

  // Verify
  const [verifying, setVerifying] = useState(false)

  const [customData, setCustomData] = useState([])

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data || [])
      }
    } catch (err) {
      if (err.name === 'AbortError') return
    }
    setLoading(false)
  }

  const handleVerify = async (userId, verified) => {
    setVerifying(true)
    const res = await fetch('/api/admin/users/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, verified }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, email_verified: verified } : u))
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => ({ ...prev, email_verified: verified }))
      }
    }
    setVerifying(false)
  }

  const selectUser = (user) => {
    setSelectedUser(user)
    setCustomData([])
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    if (filter === 'verified') return matchesSearch && u.email_verified
    if (filter === 'unverified') return matchesSearch && !u.email_verified
    return matchesSearch
  })

  const unverifiedCount = users.filter(u => !u.email_verified).length

  if (selectedUser) {
    return (
      <div className="max-w-2xl">
        <button
          onClick={() => setSelectedUser(null)}
          className="text-sm text-content-muted hover:text-content-strong mb-4"
        >
          &larr; Back to users
        </button>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold text-content">{selectedUser.name}</h1>
            <p className="text-sm text-content-muted">{selectedUser.email}</p>
            {selectedUser.phone && <p className="text-sm text-content-muted">{selectedUser.phone}</p>}
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
            selectedUser.email_verified
              ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
          }`}>
            {selectedUser.email_verified ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
            {selectedUser.email_verified ? 'Verified' : 'Unverified'}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mb-6">
          {selectedUser.email_verified ? (
            <button
              onClick={() => handleVerify(selectedUser.id, false)}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:text-amber-300 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
              Revoke verification
            </button>
          ) : (
            <button
              onClick={() => handleVerify(selectedUser.id, true)}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:text-green-300 disabled:opacity-50"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify user
            </button>
          )}

        </div>

        {/* Details */}
        <div className="border-t border-line pt-4 space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-content-muted">Role:</span>
            <span className="text-content">{selectedUser.role}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-content-muted">Joined:</span>
            <span className="text-content">{fmtDate(selectedUser.created_at)}</span>
          </div>
        </div>

        {/* Custom field values */}
        {customData.length > 0 && (
          <div className="border-t border-line pt-4 mt-4 space-y-1">
            {customData.map((item, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-content-muted">{item.label}:</span>
                <span className="text-content">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      {unverifiedCount > 0 && (
        <div className="flex justify-end mb-4">
          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full font-medium">
            {unverifiedCount} pending
          </span>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-faint" />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 ${INPUT_BARE}`}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={INPUT_BASE}
        >
          <option value="all">All</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-content-muted py-8 text-center">No users found.</p>
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 py-3 hover:bg-subtle -mx-4 px-4 cursor-pointer transition-colors"
              onClick={() => selectUser(user)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-content truncate">{user.name || 'No name'}</p>
                  {!user.email_verified && (
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                      PENDING
                    </span>
                  )}
                </div>
                <p className="text-xs text-content-muted">{user.email}</p>
              </div>
              <span className="text-xs text-content-faint">{fmtDateShort(user.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
