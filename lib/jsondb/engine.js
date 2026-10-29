/**
 * The JSON datastore: Postgres and Supabase Auth stood in for by one .json file per table, for
 * running StationMGR locally with test data (`npm run dev:json`). Never used in production:
 * next.config.mjs points @supabase/supabase-js and @supabase/ssr at ./node.js and ./remote.js only
 * when DATA_SOURCE=json, and app/api/jsondb answers nothing otherwise.
 *
 * Node only. The browser and the Edge middleware reach it through app/api/jsondb (./remote.js).
 *
 * What it answers is the part of PostgREST and Supabase Auth this app uses, and no more:
 * filters, embedded selects resolved from jsondb/schema.json's foreign keys (including !inner
 * and filters on the embedded table), order, range, single, count, insert/update/upsert/delete
 * with returning, column defaults, password sign-in, and storage as files on disk. There is no
 * row level security: every client acts as the service role.
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const ROOT = path.join(process.cwd(), 'jsondb')
const DATA_DIR = process.env.JSONDB_DIR || path.join(ROOT, 'data')
const STORAGE_DIR = path.join(DATA_DIR, 'storage')

export const SESSION_COOKIE = 'jsondb-auth'
const TOKEN_PREFIX = 'jsondb.'
const SESSION_SECONDS = 60 * 60 * 24 * 30

// ── Files ────────────────────────────────────────────────────────────────────

let schemaCache = null
function schema() {
  if (!schemaCache) schemaCache = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8')).tables
  return schemaCache
}

/** scripts/jsondb-seed.mjs fills it; `npm run dev:json` runs that first when it is missing. */
function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
}

const cache = new Map() // table → { mtimeMs, rows }

function load(table) {
  ensureData()
  const file = path.join(DATA_DIR, `${table}.json`)
  if (!fs.existsSync(file)) return []
  const { mtimeMs } = fs.statSync(file)
  const hit = cache.get(table)
  if (hit && hit.mtimeMs === mtimeMs) return hit.rows
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  cache.set(table, { mtimeMs, rows })
  return rows
}

function save(table, rows) {
  ensureData()
  const file = path.join(DATA_DIR, `${table}.json`)
  fs.writeFileSync(file, `${JSON.stringify(rows, null, 2)}\n`)
  cache.set(table, { mtimeMs: fs.statSync(file).mtimeMs, rows })
}

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)))

// ── Results ──────────────────────────────────────────────────────────────────

const ok = (data, extra = {}) => ({ data, error: null, count: null, status: 200, statusText: 'OK', ...extra })
const fail = (message, code = 'PGRST000', status = 400, details = null) => ({
  data: null,
  error: { message, code, details, hint: null },
  count: null,
  status,
  statusText: 'Bad Request',
})

// ── Values and filters ───────────────────────────────────────────────────────

const isNumeric = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)))

function compare(a, b) {
  if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b) ? 0 : String(a) < String(b) ? -1 : 1
  if (isNumeric(a) && isNumeric(b)) return Number(a) - Number(b)
  const sa = String(a), sb = String(b)
  return sa === sb ? 0 : sa < sb ? -1 : 1
}

const equals = (a, b) => a != null && b != null && compare(a, b) === 0

function likeToRegex(pattern, flags) {
  const escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${escaped}$`, flags)
}

/** PostgREST's `(a,b,"c d")` list syntax, for .filter(col, 'in', '(…)') and .not(col, 'in', …). */
function parseList(value) {
  if (Array.isArray(value)) return value
  const inner = String(value).replace(/^\(|\)$/g, '')
  return inner === '' ? [] : inner.split(',').map((s) => s.trim().replace(/^"|"$/g, ''))
}

function contains(container, value) {
  if (container == null) return false
  if (typeof container === 'string') { try { container = JSON.parse(container) } catch { return false } }
  if (Array.isArray(container)) {
    const wanted = Array.isArray(value) ? value : parseList(value)
    return wanted.every((w) => container.some((c) => JSON.stringify(c) === JSON.stringify(w) || equals(c, w)))
  }
  if (typeof container === 'object' && value && typeof value === 'object') {
    return Object.entries(value).every(([k, v]) => (v && typeof v === 'object' ? contains(container[k], v) : equals(container[k], v)))
  }
  return false
}

function test(op, actual, value) {
  switch (op) {
    case 'eq': return equals(actual, value)
    case 'neq': return actual != null && !equals(actual, value)
    case 'gt': return actual != null && compare(actual, value) > 0
    case 'gte': return actual != null && compare(actual, value) >= 0
    case 'lt': return actual != null && compare(actual, value) < 0
    case 'lte': return actual != null && compare(actual, value) <= 0
    case 'like': return actual != null && likeToRegex(value).test(String(actual))
    case 'ilike': return actual != null && likeToRegex(value, 'i').test(String(actual))
    case 'is':
      if (value === null || value === 'null') return actual == null
      return String(actual) === String(value)
    case 'in': return parseList(value).some((v) => equals(actual, v))
    case 'cs': case 'contains': return contains(actual, value)
    case 'cd': case 'containedBy': return contains(value, actual)
    default: throw new Error(`The JSON datastore does not support the "${op}" filter`)
  }
}

function passes(row, filter) {
  const result = test(filter.op, row[filter.column], filter.value)
  return filter.negate ? !result : result
}

// ── Select parsing and embedding ─────────────────────────────────────────────

function splitTop(text) {
  const parts = []
  let depth = 0, start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    else if (text[i] === ',' && depth === 0) { parts.push(text.slice(start, i)); start = i + 1 }
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** `*, users:created_by(name), subscriptions!inner(status)` → [{ column } | { embed }]. */
function parseSelect(columns) {
  const items = []
  for (const part of splitTop(String(columns || '*').replace(/\s+/g, ' '))) {
    const open = part.indexOf('(')
    if (open === -1) {
      const [alias, col] = part.includes(':') ? part.split(':') : [null, part]
      items.push({ column: col.split('::')[0].trim(), alias: alias?.trim() || null })
      continue
    }
    let head = part.slice(0, open).trim()
    const inner = part.slice(open + 1, part.lastIndexOf(')'))
    let alias = null
    if (head.includes(':')) [alias, head] = head.split(':').map((s) => s.trim())
    const [target, ...hints] = head.split('!')
    items.push({
      embed: target,
      alias,
      inner: hints.includes('inner'),
      children: parseSelect(inner),
    })
  }
  return items
}

/** How `table` reaches `target`: through one of its own columns, or `target`'s rows point back. */
function relation(table, target, alias) {
  const tables = schema()
  const fks = tables[table]?.fks || {}
  // `users:created_by(name)` names the column; `editor:updated_by` too.
  if (fks[target]) return { kind: 'one', table: fks[target], column: target }
  if (alias && fks[alias] && tables[target] === undefined) return { kind: 'one', table: fks[alias], column: alias }
  const own = Object.entries(fks).find(([, t]) => t === target)
  if (own) return { kind: 'one', table: target, column: own[0] }
  const back = Object.entries(tables[target]?.fks || {}).find(([, t]) => t === table)
  if (back) return { kind: 'many', table: target, column: back[0] }
  throw new Error(`The JSON datastore cannot find a relationship between "${table}" and "${target}"`)
}

function project(table, row, items, filters) {
  const out = {}
  for (const item of items) {
    if (item.column === '*') Object.assign(out, clone(row))
    else if (item.column) out[item.alias || item.column] = clone(row[item.column] ?? null)
  }
  for (const item of items) {
    if (!item.embed) continue
    const key = item.alias || item.embed
    const rel = relation(table, item.embed, item.alias)
    const own = filters.filter((f) => f.embed === key || f.embed === item.embed)
    const nested = own.map((f) => ({ ...f, embed: f.rest, rest: undefined })).filter((f) => f.embed)
    const direct = own.filter((f) => !f.rest).map((f) => ({ ...f, embed: null }))
    const candidates = rel.kind === 'one'
      ? load(rel.table).filter((r) => row[rel.column] != null && equals(r.id, row[rel.column]))
      : load(rel.table).filter((r) => equals(r[rel.column], row.id))
    const kept = candidates
      .filter((r) => direct.every((f) => passes(r, f)))
      .map((r) => project(rel.table, r, item.children, nested))
      .filter((r) => r !== null)
    if (rel.kind === 'one') {
      if (item.inner && !kept.length) return null
      out[key] = kept[0] || null
    } else {
      if (item.inner && !kept.length) return null
      out[key] = kept
    }
  }
  return out
}

/** `subscriptions.status` → a filter on the embed; plain names apply to the row. */
function splitFilters(filters) {
  const top = [], embedded = []
  for (const f of filters) {
    const dot = f.column.indexOf('.')
    if (dot === -1) top.push(f)
    else {
      const [embed, ...rest] = f.column.split('.')
      const column = rest[rest.length - 1]
      embedded.push({ ...f, embed, column, rest: rest.length > 1 ? rest.slice(0, -1).join('.') : undefined })
    }
  }
  return { top, embedded }
}

function shape(table, rows, op) {
  const items = parseSelect(op.columns)
  const { embedded } = splitFilters(op.filters || [])
  return rows.map((r) => project(table, r, items, embedded)).filter((r) => r !== null)
}

function sortRows(rows, orders) {
  if (!orders?.length) return rows
  return [...rows].sort((a, b) => {
    for (const o of orders) {
      const av = a[o.column], bv = b[o.column]
      if (av == null || bv == null) {
        if (av == null && bv == null) continue
        const nullsFirst = o.nullsFirst ?? !o.ascending
        return (av == null) === nullsFirst ? -1 : 1
      }
      const c = compare(av, bv)
      if (c !== 0) return o.ascending ? c : -c
    }
    return 0
  })
}

function finish(op, rows, count) {
  const extra = op.count ? { count } : {}
  if (op.head) return ok(null, extra)
  if (op.single === 'single') {
    if (rows.length !== 1) {
      return fail('JSON object requested, multiple (or no) rows returned', 'PGRST116', 406, `The result contains ${rows.length} rows`)
    }
    return ok(rows[0], extra)
  }
  if (op.single === 'maybe') {
    if (rows.length > 1) return fail('JSON object requested, multiple (or no) rows returned', 'PGRST116', 406, `The result contains ${rows.length} rows`)
    return ok(rows[0] ?? null, extra)
  }
  return ok(rows, extra)
}

// ── Queries ──────────────────────────────────────────────────────────────────

function select(op) {
  const { top } = splitFilters(op.filters || [])
  let rows = load(op.table).filter((r) => top.every((f) => passes(r, f)))
  rows = sortRows(rows, (op.orders || []).filter((o) => !o.foreignTable))
  // Embedding before paging, so !inner drops rows the way a join would before LIMIT.
  rows = shape(op.table, rows, op)
  const count = rows.length
  if (op.range) rows = rows.slice(op.range[0], op.range[1] + 1)
  if (op.limit != null) rows = rows.slice(0, op.limit)
  return finish(op, rows, count)
}

function withDefaults(table, values, defaultToNull = true) {
  const columns = schema()[table]?.columns || {}
  const row = {}
  for (const [name, col] of Object.entries(columns)) {
    if (name in values && values[name] !== undefined) continue
    const d = col.default
    if (d && typeof d === 'object' && d.fn) {
      if (d.fn === 'now') row[name] = new Date().toISOString()
      else if (d.fn === 'today') row[name] = new Date().toISOString().slice(0, 10)
      else if (d.fn === 'uuid') row[name] = randomUUID()
    } else if (d !== undefined) row[name] = clone(d)
    else if (defaultToNull) row[name] = null
  }
  for (const [k, v] of Object.entries(values)) if (v !== undefined) row[k] = clone(v)
  if (row.id == null && (columns.id || !Object.keys(columns).length)) row.id = randomUUID()
  return row
}

/** auth.users' trigger, migration 025: every new login gets a public.users profile. */
function afterAuthInsert(user) {
  const users = load('users')
  if (users.some((u) => u.id === user.id)) return
  const meta = user.user_metadata || {}
  users.push(withDefaults('users', {
    id: user.id,
    email: user.email,
    name: meta.name || '',
    phone: meta.phone ?? null,
    role: 'user',
    email_verified: false,
  }))
  save('users', users)
}

function returning(op, rows) {
  if (!op.returning) return ok(null, { status: op.action === 'insert' ? 201 : 200 })
  const shaped = shape(op.table, rows, { ...op, filters: [] })
  return finish(op, shaped, shaped.length)
}

function insert(op) {
  const rows = load(op.table)
  const incoming = (Array.isArray(op.values) ? op.values : [op.values]).map((v) => withDefaults(op.table, v, op.defaultToNull !== false))
  for (const r of incoming) {
    if (rows.some((x) => equals(x.id, r.id))) {
      return fail(`duplicate key value violates unique constraint "${op.table}_pkey"`, '23505', 409, `Key (id)=(${r.id}) already exists.`)
    }
  }
  rows.push(...incoming)
  save(op.table, rows)
  if (op.table === 'auth_users') incoming.forEach(afterAuthInsert)
  return returning(op, incoming)
}

function update(op) {
  const rows = load(op.table)
  const { top } = splitFilters(op.filters || [])
  const changed = []
  for (const r of rows) {
    if (!top.every((f) => passes(r, f))) continue
    for (const [k, v] of Object.entries(op.values || {})) if (v !== undefined) r[k] = clone(v)
    changed.push(r)
  }
  if (changed.length) save(op.table, rows)
  return returning(op, changed)
}

function upsert(op) {
  const rows = load(op.table)
  const keys = String(op.onConflict || 'id').split(',').map((s) => s.trim())
  const touched = []
  for (const values of Array.isArray(op.values) ? op.values : [op.values]) {
    const existing = keys.every((k) => values[k] != null) && rows.find((r) => keys.every((k) => equals(r[k], values[k])))
    if (existing) {
      if (op.ignoreDuplicates) continue
      for (const [k, v] of Object.entries(values)) if (v !== undefined) existing[k] = clone(v)
      touched.push(existing)
    } else {
      const row = withDefaults(op.table, values, op.defaultToNull !== false)
      rows.push(row)
      touched.push(row)
    }
  }
  save(op.table, rows)
  return returning(op, touched)
}

function remove(op) {
  const rows = load(op.table)
  const { top } = splitFilters(op.filters || [])
  const kept = [], gone = []
  for (const r of rows) (top.every((f) => passes(r, f)) ? gone : kept).push(r)
  if (gone.length) save(op.table, kept)
  return returning(op, gone)
}

export function query(op) {
  try {
    if (!schema()[op.table] && op.table !== 'auth_users') {
      return fail(`relation "public.${op.table}" does not exist`, '42P01', 404)
    }
    switch (op.action) {
      case 'select': return select(op)
      case 'insert': return insert(op)
      case 'update': return update(op)
      case 'upsert': return upsert(op)
      case 'delete': return remove(op)
      default: return fail(`Unknown action ${op.action}`)
    }
  } catch (err) {
    return fail(err.message, 'JSONDB', 400)
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function tokenFor(userId) {
  return TOKEN_PREFIX + Buffer.from(JSON.stringify({ sub: userId })).toString('base64url')
}

function userIdFrom(token) {
  if (!token || !String(token).startsWith(TOKEN_PREFIX)) return null
  try { return JSON.parse(Buffer.from(String(token).slice(TOKEN_PREFIX.length), 'base64url').toString()).sub } catch { return null }
}

/** auth.users' row as supabase-js hands it out: never the password. */
function publicUser(u) {
  if (!u) return null
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    phone: u.phone || '',
    email_confirmed_at: u.email_confirmed_at,
    confirmed_at: u.email_confirmed_at,
    last_sign_in_at: u.last_sign_in_at || null,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: u.user_metadata || {},
    created_at: u.created_at,
    updated_at: u.updated_at || u.created_at,
  }
}

function sessionFor(u) {
  const token = tokenFor(u.id)
  return {
    access_token: token,
    refresh_token: token,
    token_type: 'bearer',
    expires_in: SESSION_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    user: publicUser(u),
  }
}

const authFail = (message, code, status = 400) => ({ data: { user: null, session: null }, error: { message, code, status, name: 'AuthApiError' } })

function findAuthUser(id) {
  return id ? load('auth_users').find((u) => u.id === id) || null : null
}

function applyAttributes(u, attrs) {
  if (attrs.password) u.password = attrs.password
  if (attrs.email) u.email = String(attrs.email).toLowerCase()
  if (attrs.phone) u.phone = attrs.phone
  if (attrs.data) u.user_metadata = { ...(u.user_metadata || {}), ...attrs.data }
  if (attrs.user_metadata) u.user_metadata = { ...(u.user_metadata || {}), ...attrs.user_metadata }
  if (attrs.email_confirm === true) u.email_confirmed_at ||= new Date().toISOString()
  if (attrs.email_confirm === false) u.email_confirmed_at = null
  u.updated_at = new Date().toISOString()
}

/**
 * One auth call. `token` is the caller's session, if any. A result may carry `setSession`
 * (sign-in) or `clearSession` (sign-out) for the caller to put in or take out of its cookie.
 */
export function auth(action, args = {}, token = null) {
  const users = () => load('auth_users')
  switch (action) {
    case 'getUser': {
      const u = findAuthUser(userIdFrom(args.jwt || token))
      return u ? { data: { user: publicUser(u) }, error: null } : authFail('Auth session missing!', 'session_not_found', 401)
    }
    case 'getSession': {
      const u = findAuthUser(userIdFrom(token))
      return { data: { session: u ? sessionFor(u) : null }, error: null }
    }
    case 'signInWithPassword': {
      const email = String(args.email || '').trim().toLowerCase()
      const u = users().find((x) => (email ? x.email === email : x.phone && x.phone === args.phone))
      if (!u || u.password !== args.password) return authFail('Invalid login credentials', 'invalid_credentials')
      if (!u.email_confirmed_at) return authFail('Email not confirmed', 'email_not_confirmed')
      const all = users()
      const row = all.find((x) => x.id === u.id)
      row.last_sign_in_at = new Date().toISOString()
      save('auth_users', all)
      const session = sessionFor(row)
      return { data: { user: session.user, session }, error: null, setSession: session }
    }
    case 'signUp': {
      const email = String(args.email || '').trim().toLowerCase()
      if (!email || !args.password) return authFail('Signup requires a valid password', 'validation_failed')
      if (users().some((x) => x.email === email)) return authFail('User already registered', 'user_already_exists', 422)
      // No email goes out locally, so the address counts as confirmed straight away.
      const now = new Date().toISOString()
      const u = { id: randomUUID(), email, phone: args.phone || null, password: args.password, user_metadata: args.options?.data || {}, email_confirmed_at: now, created_at: now }
      const inserted = query({ table: 'auth_users', action: 'insert', values: u, defaultToNull: false })
      if (inserted.error) return authFail(inserted.error.message, 'unexpected_failure', 500)
      const session = sessionFor(u)
      return { data: { user: session.user, session }, error: null, setSession: session }
    }
    case 'signOut':
      return { error: null, clearSession: true }
    case 'updateUser': {
      const all = users()
      const u = all.find((x) => x.id === userIdFrom(token))
      if (!u) return authFail('Auth session missing!', 'session_not_found', 401)
      applyAttributes(u, args)
      save('auth_users', all)
      return { data: { user: publicUser(u) }, error: null }
    }
    case 'refreshSession': {
      const u = findAuthUser(userIdFrom(args.refresh_token || token))
      if (!u) return authFail('Invalid Refresh Token', 'refresh_token_not_found')
      const session = sessionFor(u)
      return { data: { user: session.user, session }, error: null, setSession: session }
    }
    // Emails and magic links: nothing is sent locally, and nothing needs to be.
    case 'resend':
    case 'signInWithOtp':
    case 'resetPasswordForEmail':
      return { data: { user: null, session: null }, error: null }
    case 'verifyOtp':
    case 'exchangeCodeForSession':
      return authFail('Email links are not available with the JSON datastore. Sign in with a password instead.', 'not_supported')

    case 'admin.getUserById': {
      const u = findAuthUser(args.id)
      return u ? { data: { user: publicUser(u) }, error: null } : authFail('User not found', 'user_not_found', 404)
    }
    case 'admin.listUsers':
      return { data: { users: users().map(publicUser), aud: 'authenticated' }, error: null }
    case 'admin.createUser': {
      const email = String(args.email || '').trim().toLowerCase()
      if (users().some((x) => x.email === email)) return authFail('A user with this email address has already been registered', 'email_exists', 422)
      const now = new Date().toISOString()
      const u = {
        id: randomUUID(), email, phone: args.phone || null, password: args.password || null,
        user_metadata: args.user_metadata || {}, email_confirmed_at: args.email_confirm ? now : null, created_at: now,
      }
      const inserted = query({ table: 'auth_users', action: 'insert', values: u, defaultToNull: false })
      if (inserted.error) return authFail(inserted.error.message, 'unexpected_failure', 500)
      return { data: { user: publicUser(u) }, error: null }
    }
    case 'admin.updateUserById': {
      const all = users()
      const u = all.find((x) => x.id === args.id)
      if (!u) return authFail('User not found', 'user_not_found', 404)
      applyAttributes(u, args.attributes || {})
      save('auth_users', all)
      return { data: { user: publicUser(u) }, error: null }
    }
    case 'admin.deleteUser': {
      const all = users()
      if (!all.some((x) => x.id === args.id)) return authFail('User not found', 'user_not_found', 404)
      save('auth_users', all.filter((x) => x.id !== args.id))
      // public.users references auth.users ON DELETE CASCADE.
      save('users', load('users').filter((x) => x.id !== args.id))
      return { data: { user: null }, error: null }
    }
    default:
      return authFail(`The JSON datastore does not support auth.${action}`, 'not_supported')
  }
}

// ── Storage ──────────────────────────────────────────────────────────────────

function storagePath(bucket, file) {
  const full = path.resolve(STORAGE_DIR, bucket, file)
  if (!full.startsWith(path.resolve(STORAGE_DIR) + path.sep)) throw new Error('Invalid storage path')
  return full
}

export const storageUrl = (bucket, file) => `/api/jsondb/storage/${encodeURIComponent(bucket)}/${String(file).split('/').map(encodeURIComponent).join('/')}`

/** `body` is a Buffer here; ./remote.js sends it as base64. */
export function storage(action, { bucket, path: file, paths, body, options } = {}) {
  try {
    switch (action) {
      case 'upload': {
        const full = storagePath(bucket, file)
        if (fs.existsSync(full) && !options?.upsert) {
          return { data: null, error: { message: 'The resource already exists', statusCode: '409' } }
        }
        fs.mkdirSync(path.dirname(full), { recursive: true })
        fs.writeFileSync(full, body)
        return { data: { path: file, id: file, fullPath: `${bucket}/${file}` }, error: null }
      }
      case 'remove': {
        const removed = []
        for (const p of paths || []) {
          const full = storagePath(bucket, p)
          if (fs.existsSync(full)) { fs.rmSync(full); removed.push({ name: p }) }
        }
        return { data: removed, error: null }
      }
      case 'createSignedUrl':
        return { data: { signedUrl: storageUrl(bucket, file) }, error: null }
      case 'getPublicUrl':
        return { data: { publicUrl: storageUrl(bucket, file) } }
      case 'download': {
        const full = storagePath(bucket, file)
        if (!fs.existsSync(full)) return { data: null, error: { message: 'Object not found', statusCode: '404' } }
        return { data: fs.readFileSync(full), error: null }
      }
      default:
        return { data: null, error: { message: `The JSON datastore does not support storage.${action}` } }
    }
  } catch (err) {
    return { data: null, error: { message: err.message } }
  }
}

export function readStorageFile(bucket, file) {
  const full = storagePath(bucket, file)
  return fs.existsSync(full) ? fs.readFileSync(full) : null
}
