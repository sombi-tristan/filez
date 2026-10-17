'use client'

import { useState } from 'react'
import { IonIcon } from '@ionic/react'
import { trashOutline } from 'ionicons/icons'
import Modal from '@/components/Modal'
import { BTN_DANGER, BTN_FRAMED } from '@/components/ui'

/**
 * An entry screen with one form and the day's entries: the form, then the list beneath it on a
 * phone, and the list in a column on the right on a computer (lg). Kept off EntryParts.js, which
 * carries the date picker.
 */
export function EntryWithDayList({ list, children }) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6 lg:items-start">
      <div className="min-w-0">{children}</div>
      <aside className="mt-6 lg:mt-0 lg:sticky lg:top-20">{list}</aside>
    </div>
  )
}

/**
 * The entries saved for the day in the date bar, each with Edit (loads it into the form) and
 * Delete (asks first). The one being edited is marked.
 *
 *   items      [{ id, primary, secondary }] in the order they were made
 *   editingId  the entry in the form, if any
 */
export function DayEntries({ title = 'Entries this day', items = [], editingId, onEdit, onDelete }) {
  const [doomed, setDoomed] = useState(null)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try { await onDelete?.(doomed) } finally {
      setBusy(false)
      setDoomed(null)
    }
  }

  return (
    <section className="border-card border-line rounded-house">
      <h2 className="flex items-center justify-between min-h-[44px] px-3 bg-subtle border-b-2 border-line text-[15px] font-semibold text-content rounded-t-[2px]">
        {title}
        <span className="text-content-muted font-medium">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-content-muted">Nothing saved for this day yet.</p>
      ) : (
        <ul className="divide-y-2 divide-line">
          {items.map((item, i) => (
            <li key={item.id} className={`flex items-center gap-2 px-3 py-2 ${item.id === editingId ? 'bg-primary-500/10' : ''}`}>
              <span className="w-6 shrink-0 text-sm text-content-faint">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-semibold text-content">{item.primary}</span>
                {item.secondary ? <span className="block truncate text-xs text-content-muted">{item.secondary}</span> : null}
                {item.id === editingId ? <span className="block text-xs font-semibold text-accent">Editing</span> : null}
              </span>
              <button type="button" onClick={() => onEdit?.(item)} aria-label={`Edit entry ${i + 1}`} className={`h-10 px-3 text-sm font-medium ${BTN_FRAMED}`}>
                Edit
              </button>
              <button type="button" onClick={() => setDoomed(item)} aria-label={`Delete entry ${i + 1}`} className="h-10 w-10 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-500/10">
                <IonIcon icon={trashOutline} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!doomed} onClose={() => { if (!busy) setDoomed(null) }} title="Delete this entry?">
        <div className="space-y-4">
          <p className="text-sm text-content">
            <strong>{doomed?.primary}</strong>{doomed?.secondary ? ` · ${doomed.secondary}` : ''} will be deleted.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDoomed(null)} disabled={busy} className={`flex-1 py-2 text-sm font-medium ${BTN_FRAMED}`}>Cancel</button>
            <button type="button" onClick={confirm} disabled={busy} className={`flex-1 py-2 text-sm font-medium disabled:opacity-50 ${BTN_DANGER}`}>Delete</button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
