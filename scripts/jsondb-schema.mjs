/**
 * Writes jsondb/schema.json from supabase/deploy/02_schema.sql: every table's columns, their
 * defaults and their foreign keys. The JSON datastore (lib/jsondb) reads it to fill a new row's
 * defaults the way Postgres would and to resolve embedded selects such as `users:created_by(name)`.
 *
 * Run it again after a migration lands in 02_schema.sql: `npm run jsondb:schema`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sql = readFileSync(join(root, 'supabase/deploy/02_schema.sql'), 'utf8')
  .replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '') // function bodies
  .replace(/--[^\n]*/g, '')

const tables = {}
// auth.users is Supabase Auth's own table; the datastore keeps it as auth_users.
const bare = (name) => name.replace(/"/g, '').replace(/^auth\./i, 'auth_').replace(/^public\./i, '')
const table = (name) => (tables[bare(name)] ||= { columns: {}, fks: {} })

/** Splits on commas that are not inside parentheses or quotes. */
function splitTop(body) {
  const parts = []
  let depth = 0, quote = false, start = 0
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === "'") quote = !quote
    if (quote) continue
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1 }
  }
  parts.push(body.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** The JSON form of a column default, or undefined when Postgres would leave it null. */
function parseDefault(def, type = '') {
  const m = def.match(/\bDEFAULT\s+((?:'(?:[^']|'')*'|[^\s,]+(?:\([^)]*\))?)(?:::\w+(?:\[\])?)?)/i)
  if (!m) return undefined
  const raw = m[1].trim()
  const lower = raw.toLowerCase()
  if (/^(now\(\)|current_timestamp|timezone\()/.test(lower)) return { fn: 'now' }
  if (lower.startsWith('current_date')) return { fn: 'today' }
  if (/uuid/.test(lower) && lower.includes('(')) return { fn: 'uuid' }
  if (lower === 'true' || lower === 'false') return lower === 'true'
  if (lower === 'null') return undefined
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  const quoted = raw.match(/^'((?:[^']|'')*)'(?:::(\w+(?:\[\])?))?$/)
  if (quoted) {
    const text = quoted[1].replace(/''/g, "'")
    const cast = (quoted[2] || type).toLowerCase()
    if (cast.includes('json')) { try { return JSON.parse(text) } catch { return text } }
    if (cast.includes('[]') || text === '{}') return []
    return text
  }
  if (lower.startsWith('array[]')) return []
  return undefined
}

function addColumn(t, def) {
  const m = def.match(/^"?(\w+)"?\s+(.+)$/s)
  if (!m) return
  const [, name, rest] = m
  if (/^(constraint|primary|unique|foreign|check|exclude)$/i.test(name)) {
    const fk = def.match(/FOREIGN\s+KEY\s*\(\s*"?(\w+)"?\s*\)\s*REFERENCES\s+([\w."]+)/i)
    if (fk) t.fks[fk[1]] = bare(fk[2])
    return
  }
  const type = rest.match(/^(\w+(?:\s+(?:varying|precision|with(?:out)?\s+time\s+zone))?(?:\([^)]*\))?(?:\[\])?)/i)?.[1].toLowerCase() || ''
  const d = parseDefault(rest, type)
  t.columns[name] = d === undefined ? { type } : { type, default: d }
  const ref = rest.match(/REFERENCES\s+([\w."]+)/i)
  if (ref) t.fks[name] = bare(ref[1])
}

// Statements in file order, so later ALTERs see the tables earlier ones made.
for (const stmt of sql.split(/;\s*(?:\n|$)/)) {
  const s = stmt.trim()
  let m
  if ((m = s.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([\w."]+)\s*\(([\s\S]*)\)\s*$/i))) {
    const t = table(m[1])
    for (const part of splitTop(m[2])) addColumn(t, part)
  } else if ((m = s.match(/^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?([\w."]+)\s+([\s\S]+)$/i))) {
    const name = bare(m[1])
    if (!tables[name]) continue
    const t = tables[name]
    const rename = m[2].match(/^RENAME\s+COLUMN\s+"?(\w+)"?\s+TO\s+"?(\w+)"?/i)
    if (rename) {
      t.columns[rename[2]] = t.columns[rename[1]] || {}
      delete t.columns[rename[1]]
      if (t.fks[rename[1]]) { t.fks[rename[2]] = t.fks[rename[1]]; delete t.fks[rename[1]] }
      continue
    }
    const renameTable = m[2].match(/^RENAME\s+TO\s+"?(\w+)"?/i)
    if (renameTable) { tables[renameTable[1]] = t; delete tables[name]; continue }
    for (const action of splitTop(m[2])) {
      let a
      if ((a = action.match(/^ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([\s\S]+)$/i))) addColumn(t, a[1])
      else if ((a = action.match(/^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/i))) { delete t.columns[a[1]]; delete t.fks[a[1]] }
      else if ((a = action.match(/^ALTER\s+COLUMN\s+"?(\w+)"?\s+SET\s+DEFAULT\s+([\s\S]+)$/i))) {
        const col = t.columns[a[1]]
        const d = col && parseDefault(`DEFAULT ${a[2]}`, col.type)
        if (col) t.columns[a[1]] = d === undefined ? { type: col.type } : { type: col.type, default: d }
      } else if ((a = action.match(/^ALTER\s+COLUMN\s+"?(\w+)"?\s+DROP\s+DEFAULT/i))) {
        if (t.columns[a[1]]) t.columns[a[1]] = { type: t.columns[a[1]].type }
      } else if ((a = action.match(/^ADD\s+(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(\s*"?(\w+)"?\s*\)\s*REFERENCES\s+([\w."]+)/i))) {
        t.fks[a[1]] = bare(a[2])
      }
    }
  } else if ((m = s.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([\w."]+)/i))) {
    delete tables[bare(m[1])]
  }
}

const out = join(root, 'jsondb', 'schema.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify({ source: 'supabase/deploy/02_schema.sql', tables }, null, 2)}\n`)
console.log(`${Object.keys(tables).length} tables written to ${out}`)
