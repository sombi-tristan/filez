import Dexie from 'dexie'
import schema from './schema.json'

/**
 * The desktop build's "server database": one IndexedDB object store per Postgres table the app
 * used to reach through Supabase, holding rows in exactly the server's snake_case shape.
 *
 * It sits beside the existing client mirror (lib/db.js, camelCase). The original API route code
 * runs in-process against this store (lib/local/routes), so validation, defaults and the
 * one-close-of-business-per-day rule behave as they did online — nothing leaves the machine.
 */
export const TABLES = Object.keys(schema)

export const store = new Dexie('StationMGrLocal')

store.version(1).stores(
  Object.fromEntries(TABLES.map((t) => [t, schema[t].columns.includes('org_id') ? 'id, org_id' : 'id']))
)

store.version(2).stores({
  // Files that used to live in Supabase Storage (imprest receipts). Rows hold a data: URL.
  files: 'id',
})

export function columnsOf(table) {
  return schema[table]?.columns || []
}

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Column defaults, resolved per insert the way Postgres evaluates them. */
export function applyDefaults(table, row) {
  const out = { ...row }
  const defaults = schema[table]?.defaults || {}
  for (const [col, d] of Object.entries(defaults)) {
    if (out[col] !== undefined) continue
    if (d && typeof d === 'object' && d.fn) {
      if (d.fn === 'uuid') out[col] = uuid()
      else if (d.fn === 'now') out[col] = new Date().toISOString()
      else if (d.fn === 'today') out[col] = new Date().toISOString().slice(0, 10)
    } else {
      out[col] = d && typeof d === 'object' ? JSON.parse(JSON.stringify(d)) : d
    }
  }
  if (out.id === undefined) out.id = uuid()
  return out
}
