import { store } from './store'
import { SYNC_TABLES } from '@/lib/desktopTables'

/**
 * What this computer has changed since it last pushed to the linked web station.
 *
 * Every write the in-app server makes (lib/local/supabase.js) to a synced table
 * (lib/desktopTables.js) lands here as one entry per row: `${table}:${id}` → the last thing that
 * happened to it, 'upsert' or 'delete'. A push (lib/local/webSync.js) sends each row as it now
 * stands and clears the entries the web accepted. A pull never writes here: it writes the store
 * directly, so rows that came from the web are not sent back.
 */
export async function recordChanges(table, rows, op) {
  if (!SYNC_TABLES[table] || !rows?.length) return
  const at = Date.now()
  await store.outbox.bulkPut(rows.map((r) => ({ key: `${table}:${r.id}`, table, id: r.id, op, at })))
}

/** Every pending change, oldest first. */
export function pendingChanges() {
  return store.outbox.orderBy('at').toArray()
}

export function pendingCount() {
  return store.outbox.count()
}

/** Forget changes the web accepted, unless the row changed again while they were in flight. */
export async function clearChanges(sent) {
  await store.transaction('rw', store.outbox, async () => {
    for (const change of sent) {
      const now = await store.outbox.get(change.key)
      if (now && now.at === change.at) await store.outbox.delete(change.key)
    }
  })
}

/** Every row of every synced table counts as changed: for a first push of a computer's own data. */
export async function markEverythingChanged() {
  const at = Date.now()
  for (const table of Object.keys(SYNC_TABLES)) {
    const rows = await store[table].toArray()
    if (rows.length) await store.outbox.bulkPut(rows.map((r) => ({ key: `${table}:${r.id}`, table, id: r.id, op: 'upsert', at })))
  }
}
