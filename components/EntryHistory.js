'use client'

/**
 * The line under an entry in the day's form (components/entries/DayEntries.js): who added it and
 * when, and who last changed it and when. It replaces the station's Notifications screen.
 *
 * The names come with the rows (the entry routes join users:created_by and editor:updated_by;
 * lib/sync.js normalizeEntry keeps them). An entry changed before updated_by was recorded
 * (migration 058) shows the edit's time without a name.
 */

// A save writes updated_at a moment after created_at; only a later change is an edit.
const EDITED_AFTER = 60 * 1000

function when(iso) {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** One history for a receipt kept as several rows (one per tank): its first add, its latest change. */
export function combineHistory(rows = []) {
  const saved = rows.filter((r) => r.createdAt)
  if (!saved.length) return rows[0] || null
  const first = saved.reduce((a, b) => (a.createdAt <= b.createdAt ? a : b))
  const last = saved.reduce((a, b) => ((a.updatedAt || '') >= (b.updatedAt || '') ? a : b))
  return {
    createdAt: first.createdAt,
    createdByName: first.createdByName,
    updatedAt: last.updatedAt,
    updatedByName: last.updatedByName,
  }
}

export default function EntryHistory({ entry }) {
  if (!entry) return null
  if (!entry.createdAt) {
    return <span className="block text-xs text-content-faint">Not on the server yet</span>
  }

  const added = entry.createdByName ? `Added by ${entry.createdByName}` : 'Added'
  const parts = [`${added} · ${when(entry.createdAt)}`]
  const edited = entry.updatedAt && Date.parse(entry.updatedAt) - Date.parse(entry.createdAt) > EDITED_AFTER
  if (edited) parts.push(`Edited ${when(entry.updatedAt)}${entry.updatedByName ? ` by ${entry.updatedByName}` : ''}`)

  return <span className="block truncate text-xs text-content-faint">{parts.join(' · ')}</span>
}
