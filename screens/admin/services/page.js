'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, X, Pencil, ToggleLeft, ToggleRight, Fuel, Droplets, Users } from 'lucide-react'
import { INPUT, IconChip } from '@/components/ui'

// The design system has no solid fills; weight comes from how hard the outline is drawn.
const SOLID_ACTION = 'border-2 border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30'

const SERVICE_ICONS = {
  'fuel-operations': Fuel,
  'lube-management': Droplets,
  'customer-payments': Users,
}

export default function AdminServicesPage() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(null)
  const [error, setError] = useState('')
  const [price, setPrice] = useState('')

  const loadServices = async () => {
    const res = await fetch('/api/services')
    if (res.ok) {
      const data = await res.json()
      setServices(data.services || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadServices() }, [])

  const startEdit = (svc) => {
    setEditingId(svc.id)
    setPrice(String(svc.price))
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setPrice('')
    setError('')
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!price || Number(price) < 0) { setError('Valid price is required'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/services', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, price: Number(price) }),
    })

    if (res.ok) {
      cancelEdit()
      loadServices()
    } else {
      const data = await res.json()
      setError(data.error || 'Failed to update')
    }
    setSaving(false)
  }

  const toggleActive = async (svc) => {
    if (toggling) return
    setToggling(svc.id)
    try {
      await fetch('/api/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: svc.id, is_active: !svc.is_active }),
      })
      await loadServices()
    } finally {
      setToggling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-content-faint" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-content-muted mb-6">
        Set subscription prices for each service. Only active services are shown on the subscribe page.
      </p>

      {services.length === 0 ? (
        <p className="text-sm text-content-muted py-8 text-center">No services found. Run migration 017 to seed them.</p>
      ) : (
        <div className="divide-y divide-line">
          {services.map((svc) => {
            const Icon = SERVICE_ICONS[svc.key] || Fuel
            return (
              <div key={svc.id} className="py-4">
                {editingId === svc.id ? (
                  <form onSubmit={handleUpdate} className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <IconChip icon={Icon} className="w-10 h-10" iconClass="w-5 h-5" />
                      <p className="text-sm font-medium text-content">{svc.name}</p>
                    </div>
                    <div>
                      <label className="block text-xs text-content-muted mb-1">Price (NGN)</label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        className={INPUT}
                        autoFocus
                      />
                    </div>
                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className={`flex items-center gap-1 px-3 py-1.5 text-sm disabled:opacity-50 ${SOLID_ACTION}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Save
                      </button>
                      <button type="button" onClick={cancelEdit} className="p-1.5 text-content-faint hover:text-content-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <IconChip icon={Icon} className="w-10 h-10" iconClass="w-5 h-5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-content">{svc.name}</p>
                        {!svc.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-subtle text-content-muted font-medium">Inactive</span>
                        )}
                      </div>
                      {svc.description && <p className="text-xs text-content-muted mt-0.5">{svc.description}</p>}
                    </div>
                    <span className="text-sm font-semibold text-content whitespace-nowrap">
                      {Number(svc.price).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })}
                    </span>
                    <button onClick={() => toggleActive(svc)} disabled={toggling === svc.id} className="p-1.5 text-content-faint hover:text-primary-600 disabled:opacity-50" title={svc.is_active ? 'Deactivate' : 'Activate'}>
                      {svc.is_active ? <ToggleRight className="w-5 h-5 text-green-600 dark:text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button onClick={() => startEdit(svc)} className="p-1.5 text-content-faint hover:text-content-muted" title="Edit price">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
