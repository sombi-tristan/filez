import { store, TABLES, columnsOf, applyDefaults } from './store'
import { getSessionUserId } from './session'

/**
 * A local stand-in for the slice of supabase-js the route handlers use: from().select/insert/
 * upsert/update/delete with PostgREST-style filters, embedded relations (users:created_by(name),
 * subscriptions!inner(...)), count, range, single/maybeSingle — plus auth.getUser and the two
 * storage calls. Results come back as { data, error, count } and it never throws, like the
 * real client, so the route code that checks `error` keeps working unchanged.
 */

// Foreign-key columns → the table they point at. Drives embedded selects.
const FK = {
  created_by: 'users',
  owner_id: 'users',
  user_id: 'users',
  org_id: 'organizations',
  product_id: 'station_lube_products',
  tank_id: 'station_tanks',
  customer_id: 'station_customers',
  bank_id: 'station_banks',
  subscription_id: 'subscriptions',
  station_group_id: 'station_groups',
  service_id: 'services',
  imprest_period_id: 'imprest_periods',
}

// Unique constraints and partial unique indexes from the migrations that the app relies on.
const UNIQUE = {
  daily_sales_entries: [
    { cols: ['org_id', 'entry_date'], where: (r) => r.close_of_business === true && r.deleted_at == null },
  ],
  imprest_periods: [{ cols: ['org_id', 'month', 'year'] }],
  org_invites: [{ cols: ['org_id', 'email'] }],
  organizations: [{ cols: ['slug'] }],
}

const err = (message, code) => ({ message, code: code || 'LOCAL', details: null, hint: null })

// ── select parsing ──────────────────────────────────────────────────────────────────────────

function splitTop(s) {
  const out = []; let depth = 0; let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = '' } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function parseSelect(sel) {
  const items = []
  for (const part of splitTop(sel || '*')) {
    const embed = part.match(/^(?:(\w+):)?(\w+)(?:!(\w+))?(?:!(\w+))?\s*\(([\s\S]*)\)$/)
    if (embed) {
      const [, alias, target, h1, h2, inner] = embed
      const hints = [h1, h2].filter(Boolean)
      items.push({
        kind: 'embed',
        alias: alias || target,
        target,
        inner: hints.includes('inner'),
        hint: hints.find((h) => h !== 'inner' && h !== 'left'),
        select: parseSelect(inner),
      })
      continue
    }
    if (part === '*') { items.push({ kind: 'star' }); continue }
    const col = part.match(/^(?:(\w+):)?(\w+)(?:::\w+)?$/)
    if (col) items.push({ kind: 'col', alias: col[1] || col[2], name: col[2] })
  }
  return items
}

// ── comparisons ─────────────────────────────────────────────────────────────────────────────

function isNum(v) { return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) && !/^\d{4}-\d{2}-\d{2}/.test(v)) }

function cmp(a, b) {
  if (typeof a === 'number' || typeof b === 'number') {
    if (isNum(a) && isNum(b)) return Number(a) - Number(b)
  }
  const sa = String(a); const sb = String(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

function eqv(a, b) {
  if (a == null || b == null) return false
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b)
  if ((typeof a === 'number' || typeof b === 'number') && isNum(a) && isNum(b)) return Number(a) === Number(b)
  return String(a) === String(b)
}

function likeToRegex(pattern, flags) {
  const esc = String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${esc}$`, flags)
}

function parseValueList(v) {
  if (Array.isArray(v)) return v
  return String(v).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''))
}

function test(op, actual, value) {
  switch (op) {
    case 'eq': return eqv(actual, value)
    case 'neq': return actual != null && !eqv(actual, value)
    case 'gt': return actual != null && cmp(actual, value) > 0
    case 'gte': return actual != null && cmp(actual, value) >= 0
    case 'lt': return actual != null && cmp(actual, value) < 0
    case 'lte': return actual != null && cmp(actual, value) <= 0
    case 'is':
      if (value === null || value === 'null') return actual == null
      if (value === true || value === 'true') return actual === true
      if (value === false || value === 'false') return actual === false
      return false
    case 'in': return actual != null && parseValueList(value).some((v) => eqv(actual, v))
    case 'like': return actual != null && likeToRegex(value).test(String(actual))
    case 'ilike': return actual != null && likeToRegex(value, 'i').test(String(actual))
    case 'cs': {
      const want = typeof value === 'string' ? JSON.parse(value) : value
      return Array.isArray(actual) && [].concat(want).every((w) => actual.includes(w))
    }
    default: return true
  }
}

function parseOr(expr) {
  // "a.eq.1,b.is.null" → [{col, op, value, negate}]
  return splitTop(expr).map((p) => {
    const m = p.match(/^(\w+)\.(not\.)?(\w+)\.(.*)$/)
    if (!m) return null
    let value = m[4]
    if (value === 'null') value = null
    return { col: m[1], negate: !!m[2], op: m[3], value }
  }).filter(Boolean)
}

// ── relations ───────────────────────────────────────────────────────────────────────────────

function resolveRelation(source, embed, sampleRow) {
  const { target, hint } = embed
  // alias:fk_column(...)
  if (FK[target] && (columnsOf(source).includes(target) || (sampleRow && target in sampleRow))) {
    return { type: 'one', table: FK[target], localCol: target }
  }
  if (TABLES.includes(target)) {
    // Many-to-one: a column on the source pointing at the target.
    const cols = columnsOf(source)
    const candidates = Object.keys(FK).filter((c) => FK[c] === target && cols.includes(c))
    if (hint && cols.includes(hint)) return { type: 'one', table: target, localCol: hint }
    if (candidates.length) return { type: 'one', table: target, localCol: candidates[0] }
    // One-to-many: a column on the target pointing back at the source.
    const back = Object.keys(FK).filter((c) => FK[c] === source && columnsOf(target).includes(c))
    if (back.length) return { type: 'many', table: target, remoteCol: hint && back.includes(hint) ? hint : back[0] }
  }
  return null
}

async function loadAll(table) {
  if (!store[table]) return []
  return store[table].toArray()
}

function projectRow(table, row, items, cache) {
  const out = {}
  for (const it of items) {
    if (it.kind === 'star') {
      for (const c of columnsOf(table)) out[c] = row[c] ?? null
      for (const [k, v] of Object.entries(row)) if (!(k in out) && !k.startsWith('__')) out[k] = v
    } else if (it.kind === 'col') {
      out[it.alias] = row[it.name] ?? null
    } else if (it.kind === 'embed') {
      const val = row[`__embed_${it.alias}`]
      const rel = row[`__rel_${it.alias}`]
      if (!rel) { out[it.alias] = null; continue }
      if (Array.isArray(val)) out[it.alias] = val.map((r) => projectRow(rel.table, r, it.select, cache))
      else out[it.alias] = val ? projectRow(rel.table, val, it.select, cache) : null
    }
  }
  return out
}

async function embedRows(table, rows, items, cache) {
  for (const it of items) {
    if (it.kind !== 'embed') continue
    const rel = resolveRelation(table, it, rows[0])
    if (!rel) continue
    if (!cache[rel.table]) cache[rel.table] = await loadAll(rel.table)
    const targetRows = cache[rel.table]
    if (rel.type === 'one') {
      const byId = new Map(targetRows.map((r) => [String(r.id), r]))
      for (const r of rows) {
        const hit = r[rel.localCol] != null ? byId.get(String(r[rel.localCol])) : null
        r[`__embed_${it.alias}`] = hit ? { ...hit } : null
        r[`__rel_${it.alias}`] = rel
      }
    } else {
      for (const r of rows) {
        r[`__embed_${it.alias}`] = targetRows.filter((t) => eqv(t[rel.remoteCol], r.id)).map((t) => ({ ...t }))
        r[`__rel_${it.alias}`] = rel
      }
    }
    // Nested embeds.
    const nested = it.select.filter((s) => s.kind === 'embed')
    if (nested.length) {
      const children = rows.flatMap((r) => [].concat(r[`__embed_${it.alias}`] || []))
      if (children.length) await embedRows(rel.table, children, it.select, cache)
    }
  }
}

// ── query builder ───────────────────────────────────────────────────────────────────────────

class Query {
  constructor(table) {
    this.table = table
    this.action = null
    this.selectStr = '*'
    this.returning = false
    this.filters = []
    this.orders = []
    this.rangeFrom = null
    this.rangeTo = null
    this.limitN = null
    this.singleMode = null
    this.countMode = null
    this.head = false
    this.payload = null
    this.upsertOpts = {}
  }

  select(cols = '*', opts = {}) {
    if (this.action) { this.returning = true; this.selectStr = cols || '*' }
    else { this.action = 'select'; this.selectStr = cols || '*' }
    if (opts.count) this.countMode = opts.count
    if (opts.head) this.head = true
    return this
  }
  insert(rows, opts = {}) { this.action = 'insert'; this.payload = rows; if (opts.count) this.countMode = opts.count; return this }
  upsert(rows, opts = {}) { this.action = 'upsert'; this.payload = rows; this.upsertOpts = opts; return this }
  update(values, opts = {}) { this.action = 'update'; this.payload = values; if (opts.count) this.countMode = opts.count; return this }
  delete(opts = {}) { this.action = 'delete'; if (opts.count) this.countMode = opts.count; return this }

  _f(col, op, value, negate = false) { this.filters.push({ col, op, value, negate }); return this }
  eq(c, v) { return this._f(c, 'eq', v) }
  neq(c, v) { return this._f(c, 'neq', v) }
  gt(c, v) { return this._f(c, 'gt', v) }
  gte(c, v) { return this._f(c, 'gte', v) }
  lt(c, v) { return this._f(c, 'lt', v) }
  lte(c, v) { return this._f(c, 'lte', v) }
  is(c, v) { return this._f(c, 'is', v) }
  in(c, v) { return this._f(c, 'in', v) }
  like(c, v) { return this._f(c, 'like', v) }
  ilike(c, v) { return this._f(c, 'ilike', v) }
  contains(c, v) { return this._f(c, 'cs', v) }
  match(obj) { for (const [k, v] of Object.entries(obj || {})) this.eq(k, v); return this }
  filter(c, op, v) { return this._f(c, op, v) }
  not(c, op, v) { return this._f(c, op, v, true) }
  or(expr) { this.filters.push({ or: parseOr(expr) }); return this }
  order(col, { ascending = true, nullsFirst, foreignTable, referencedTable } = {}) {
    if (foreignTable || referencedTable) return this
    this.orders.push({ col, ascending, nullsFirst: nullsFirst ?? !ascending })
    return this
  }
  range(from, to) { this.rangeFrom = from; this.rangeTo = to; return this }
  limit(n) { this.limitN = n; return this }
  single() { this.singleMode = 'single'; return this }
  maybeSingle() { this.singleMode = 'maybe'; return this }
  throwOnError() { return this }
  abortSignal() { return this }

  then(resolve, reject) { return this._run().then(resolve, reject) }
  catch(reject) { return this._run().catch(reject) }
  finally(fn) { return this._run().finally(fn) }

  _matches(row) {
    for (const f of this.filters) {
      if (f.or) {
        if (!f.or.some((o) => test(o.op, row[o.col], o.value) !== o.negate)) return false
        continue
      }
      if (f.col.includes('.')) continue // embedded filters are applied after embedding
      const ok = test(f.op, row[f.col], f.value)
      if (ok === f.negate) return false
    }
    return true
  }

  _applyEmbeddedFilters(rows, items) {
    const embedded = this.filters.filter((f) => f.col && f.col.includes('.'))
    if (!embedded.length) return rows
    const innerAliases = new Set(items.filter((i) => i.kind === 'embed' && i.inner).map((i) => i.alias))
    return rows.filter((row) => {
      for (const f of embedded) {
        const [alias, col] = f.col.split('.')
        const key = `__embed_${alias}`
        const val = row[key]
        if (Array.isArray(val)) {
          row[key] = val.filter((r) => test(f.op, r[col], f.value) !== f.negate)
          if (innerAliases.has(alias) && !row[key].length) return false
        } else if (val) {
          if (test(f.op, val[col], f.value) === f.negate) {
            row[key] = null
            if (innerAliases.has(alias)) return false
          }
        } else if (innerAliases.has(alias)) {
          return false
        }
      }
      // !inner with no filter still drops rows with nothing to join.
      for (const a of innerAliases) {
        const v = row[`__embed_${a}`]
        if (v == null || (Array.isArray(v) && !v.length)) return false
      }
      return true
    })
  }

  async _candidates() {
    const t = store[this.table]
    if (!t) return []
    const orgEq = this.filters.find((f) => f.col === 'org_id' && f.op === 'eq' && !f.negate && f.value != null)
    if (orgEq && columnsOf(this.table).includes('org_id')) return t.where('org_id').equals(String(orgEq.value)).toArray()
    const idEq = this.filters.find((f) => f.col === 'id' && f.op === 'eq' && !f.negate && f.value != null)
    if (idEq) { const r = await t.get(String(idEq.value)); return r ? [r] : [] }
    return t.toArray()
  }

  _sort(rows) {
    if (!this.orders.length) return rows
    return rows.sort((a, b) => {
      for (const o of this.orders) {
        const av = a[o.col]; const bv = b[o.col]
        if (av == null && bv == null) continue
        if (av == null) return o.nullsFirst ? -1 : 1
        if (bv == null) return o.nullsFirst ? 1 : -1
        const c = cmp(av, bv)
        if (c !== 0) return o.ascending ? c : -c
      }
      return 0
    })
  }

  async _checkUnique(rows, ignoreIds = new Set()) {
    const rules = UNIQUE[this.table]
    if (!rules) return null
    const existing = (await store[this.table].toArray()).filter((r) => !ignoreIds.has(r.id))
    const all = [...existing]
    for (const row of rows) {
      for (const rule of rules) {
        if (rule.where && !rule.where(row)) continue
        const clash = all.find((o) => o.id !== row.id && (!rule.where || rule.where(o)) && rule.cols.every((c) => eqv(o[c], row[c])))
        if (clash) return err(`duplicate key value violates unique constraint on ${this.table} (${rule.cols.join(', ')})`, '23505')
      }
      all.push(row)
    }
    return null
  }

  _finish(rows, { count } = {}) {
    let data = rows
    if (this.head) data = null
    if (this.singleMode && data) {
      if (data.length === 1) data = data[0]
      else if (data.length === 0 && this.singleMode === 'maybe') data = null
      else {
        return { data: null, error: err(data.length ? 'JSON object requested, multiple (or no) rows returned' : 'JSON object requested, multiple (or no) rows returned', 'PGRST116'), count: count ?? null, status: 406 }
      }
    }
    return { data, error: null, count: count ?? null, status: 200 }
  }

  async _project(rows) {
    const items = parseSelect(this.selectStr)
    const cache = {}
    const copies = rows.map((r) => ({ ...r }))
    await embedRows(this.table, copies, items, cache)
    return { items, rows: copies }
  }

  async _run() {
    try {
      if (!store[this.table]) return { data: null, error: err(`relation "${this.table}" does not exist`, '42P01'), count: null }
      switch (this.action) {
        case 'insert': return await this._insert()
        case 'upsert': return await this._upsert()
        case 'update': return await this._update()
        case 'delete': return await this._delete()
        default: return await this._select()
      }
    } catch (e) {
      console.error('[local db]', this.table, this.action, e)
      return { data: null, error: err(e?.message || String(e)), count: null }
    }
  }

  async _select() {
    let rows = (await this._candidates()).filter((r) => this._matches(r))
    const { items, rows: embedded } = await this._project(rows)
    rows = this._applyEmbeddedFilters(embedded, items)
    const count = this.countMode ? rows.length : undefined
    rows = this._sort(rows)
    if (this.rangeFrom != null) rows = rows.slice(this.rangeFrom, this.rangeTo + 1)
    if (this.limitN != null) rows = rows.slice(0, this.limitN)
    return this._finish(rows.map((r) => projectRow(this.table, r, items)), { count })
  }

  async _returning(rows) {
    if (!this.returning) return { data: null, error: null, count: this.countMode ? rows.length : null, status: 201 }
    const { items, rows: embedded } = await this._project(rows)
    return this._finish(embedded.map((r) => projectRow(this.table, r, items)), { count: this.countMode ? rows.length : undefined })
  }

  async _insert() {
    const rows = [].concat(this.payload || []).map((r) => applyDefaults(this.table, r))
    const dup = await this._checkUnique(rows)
    if (dup) return { data: null, error: dup, count: null, status: 409 }
    for (const r of rows) {
      if (await store[this.table].get(r.id)) return { data: null, error: err('duplicate key value violates unique constraint (id)', '23505'), count: null, status: 409 }
    }
    await store[this.table].bulkAdd(rows)
    return this._returning(rows)
  }

  async _upsert() {
    const conflict = String(this.upsertOpts.onConflict || 'id').split(',').map((s) => s.trim())
    const incoming = [].concat(this.payload || [])
    const all = await store[this.table].toArray()
    const out = []
    const replacedIds = new Set()
    for (const row of incoming) {
      const existing = conflict.every((c) => row[c] !== undefined)
        ? all.find((e) => conflict.every((c) => eqv(e[c], row[c])))
        : null
      if (existing) {
        if (this.upsertOpts.ignoreDuplicates) continue
        replacedIds.add(existing.id)
        out.push({ ...existing, ...row, id: existing.id })
      } else {
        out.push(applyDefaults(this.table, row))
      }
    }
    const dup = await this._checkUnique(out, replacedIds)
    if (dup) return { data: null, error: dup, count: null, status: 409 }
    await store[this.table].bulkPut(out)
    return this._returning(out)
  }

  async _update() {
    const rows = (await this._candidates()).filter((r) => this._matches(r))
    const updated = rows.map((r) => ({ ...r, ...this.payload, id: r.id }))
    const dup = await this._checkUnique(updated, new Set(rows.map((r) => r.id)))
    if (dup) return { data: null, error: dup, count: null, status: 409 }
    if (updated.length) await store[this.table].bulkPut(updated)
    return this._returning(updated)
  }

  async _delete() {
    const rows = (await this._candidates()).filter((r) => this._matches(r))
    if (rows.length) await store[this.table].bulkDelete(rows.map((r) => r.id))
    return this._returning(rows)
  }
}

// ── storage ─────────────────────────────────────────────────────────────────────────────────

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(file)
  })
}

// Uploads made this session, so getPublicUrl (synchronous, called right after upload) can hand
// back the file itself as a data: URL. That URL is what gets saved on the row, so an <img> or a
// PDF export reads it directly, with no file server and nothing to resolve after a restart.
const uploaded = new Map()

function bucket(name) {
  return {
    async upload(path, file) {
      try {
        const dataUrl = await readAsDataUrl(file)
        await store.files.put({ id: `${name}/${path}`, dataUrl, type: file.type, size: file.size, createdAt: Date.now() })
        uploaded.set(`${name}/${path}`, dataUrl)
        return { data: { path }, error: null }
      } catch (e) {
        return { data: null, error: err(e?.message || 'upload failed') }
      }
    },
    getPublicUrl(path) {
      return { data: { publicUrl: uploaded.get(`${name}/${path}`) || '' } }
    },
    async createSignedUrl(path) {
      const f = await store.files.get(`${name}/${path}`)
      return f ? { data: { signedUrl: f.dataUrl }, error: null } : { data: null, error: err('not found') }
    },
  }
}

// ── client ──────────────────────────────────────────────────────────────────────────────────

export function createLocalClient() {
  return {
    from: (table) => new Query(table),
    rpc: async () => ({ data: null, error: err('rpc is not available offline') }),
    storage: { from: bucket },
    auth: {
      async getUser() {
        const id = getSessionUserId()
        if (!id) return { data: { user: null }, error: null }
        const u = await store.users.get(id)
        return { data: { user: u ? { id: u.id, email: u.email } : null }, error: null }
      },
      async getSession() {
        const id = getSessionUserId()
        return { data: { session: id ? { user: { id } } : null }, error: null }
      },
    },
  }
}

export const localDb = createLocalClient()
