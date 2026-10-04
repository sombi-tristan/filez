// Generates lib/local/schema.json from the Supabase migrations: every table the desktop build
// keeps, with each column's DEFAULT, so the local store fills in the same values Postgres would.
//
//   node scripts/gen-local-schema.mjs
//
// Re-run after adding a migration that adds columns with defaults.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'supabase/migrations'
const sql = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => readFileSync(join(dir, f), 'utf8'))
  .join('\n')
  .replace(/--[^\n]*/g, '')

const tables = {}
const ensure = (t) => (tables[t] ||= { columns: {} })
const clean = (t) => t.replace(/^public\./i, '').replace(/"/g, '').toLowerCase()

function parseDefault(raw) {
  if (raw == null) return undefined
  let v = raw.trim().replace(/::[a-z_ ]+(\[\])?$/i, '')
  if (/^gen_random_uuid\(\)$/i.test(v)) return { fn: 'uuid' }
  if (/^now\(\)$/i.test(v) || /^current_timestamp$/i.test(v)) return { fn: 'now' }
  if (/^current_date$/i.test(v)) return { fn: 'today' }
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true'
  if (/^null$/i.test(v)) return null
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  const s = v.match(/^'(.*)'$/s)
  if (s) {
    const str = s[1].replace(/''/g, "'")
    try { if (/^[[{]/.test(str)) return JSON.parse(str) } catch { /* fall through */ }
    return str
  }
  return undefined
}

function addColumn(table, def) {
  const m = def.trim().match(/^"?([a-z_][a-z0-9_]*)"?\s+([a-z]+)/i)
  if (!m) return
  const name = m[1].toLowerCase()
  if (['constraint', 'primary', 'unique', 'foreign', 'check'].includes(name)) return
  const d = def.match(/\bdefault\s+((?:'[^']*'|\([^)]*\)|[^\s,])+(?:\s*::\s*[a-z_]+)?)/i)
  ensure(table).columns[name] = { type: m[2].toLowerCase(), default: d ? parseDefault(d[1]) : undefined }
}

function splitTop(body) {
  const out = []; let depth = 0; let cur = ''; let q = false
  for (const ch of body) {
    if (ch === "'") q = !q
    if (!q && ch === '(') depth++
    if (!q && ch === ')') depth--
    if (!q && ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

for (const m of sql.matchAll(/create table (?:if not exists )?([\w."]+)\s*\(([\s\S]*?)\);/gi)) {
  const t = clean(m[1])
  for (const part of splitTop(m[2])) addColumn(t, part)
}

for (const m of sql.matchAll(/alter table (?:only )?(?:if exists )?([\w."]+)\s+([\s\S]*?);/gi)) {
  const t = clean(m[1])
  for (const part of splitTop(m[2])) {
    const add = part.match(/^\s*add column (?:if not exists )?([\s\S]+)$/i)
    if (add) { addColumn(t, add[1]); continue }
    const setDef = part.match(/^\s*alter column "?(\w+)"? set default ([\s\S]+)$/i)
    if (setDef && tables[t]?.columns[setDef[1]]) tables[t].columns[setDef[1]].default = parseDefault(setDef[2])
    const drop = part.match(/^\s*drop column (?:if exists )?"?(\w+)"?/i)
    if (drop && tables[t]) delete tables[t].columns[drop[1]]
  }
}

for (const m of sql.matchAll(/drop table (?:if exists )?([\w."]+)/gi)) delete tables[clean(m[1])]

// Only what the desktop app reads or writes.
const KEEP = [
  'users', 'organizations', 'org_invites', 'services', 'subscriptions', 'subscription_items',
  'station_groups', 'station_pumps', 'station_tanks', 'station_banks', 'station_lube_products',
  'station_customers', 'station_messages', 'admin_activity_logs', 'excel_templates',
  'daily_sales_entries', 'product_receipt_entries', 'lodgement_entries', 'lube_sales_entries',
  'lube_stock_entries', 'customer_payment_entries', 'imprest_periods', 'imprest_entries',
]
const out = {}
for (const t of KEEP) {
  const cols = tables[t]?.columns || {}
  const defaults = {}
  for (const [c, { default: d }] of Object.entries(cols)) if (d !== undefined) defaults[c] = d
  out[t] = { columns: Object.keys(cols), defaults }
}
// public.users mirrors auth.users and is created by a trigger, not CREATE TABLE in public here.
out.users.columns = [...new Set([...out.users.columns, 'id', 'email', 'name', 'phone', 'role', 'org_id', 'email_verified', 'pin_hash', 'created_at'])]
out.users.defaults = { role: 'user', email_verified: true, ...out.users.defaults }

writeFileSync('lib/local/schema.json', JSON.stringify(out, null, 2) + '\n')
console.log(Object.entries(out).map(([t, v]) => `${t}: ${v.columns.length} cols, ${Object.keys(v.defaults).length} defaults`).join('\n'))
