/**
 * Pins how a StationMGR Desktop computer creates a new web station for its records
 * (lib/newStation.js, used by app/api/desktop/link with createName): the station belongs to the
 * owner who signed in, its slug is unique, and it starts with no subscription, so its records
 * wait on the computer for the first push once one is running.
 *
 * A stand-in for the Supabase client records what is written, so no database is needed.
 *
 * Run: node tests/desktop-create-station.test.mjs
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const { createOwnedStation, stationSlug } = await import(pathToFileURL(resolve(root, 'lib', 'newStation.js')).href)

let failures = 0
function check(name, ok) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

function fakeDb({ takenSlugs = [] } = {}) {
  const writes = []
  const db = {
    writes,
    from(table) {
      const q = { table, filters: {} }
      const api = {
        select() { return api },
        eq(col, val) { q.filters[col] = val; return api },
        async maybeSingle() {
          if (table === 'organizations' && takenSlugs.includes(q.filters.slug)) return { data: { id: 'x' } }
          return { data: null }
        },
        insert(row) { writes.push({ table, op: 'insert', row }); q.row = row; return api },
        update(row) { q.update = row; return { eq: async (col, val) => { writes.push({ table, op: 'update', row, where: { [col]: val } }); return {} } } },
        async single() { return { data: { id: 'new-station', name: q.row.name, location: q.row.location ?? null }, error: null } },
      }
      return api
    },
  }
  return db
}

console.log('A new station from a computer')
const db = fakeDb()
const { station, error } = await createOwnedStation(db, { ownerId: 'owner-1', name: '  Kubwa Filling  ' })
const insert = db.writes.find((w) => w.table === 'organizations' && w.op === 'insert')
check('is created', !error && station?.id === 'new-station')
check('belongs to the owner who signed in', insert?.row.owner_id === 'owner-1')
check('takes the name, trimmed', insert?.row.name === 'Kubwa Filling')
check('has a slug from the name', insert?.row.slug === 'kubwa-filling')
check('is not marked set up: the computer’s push says so', insert?.row.onboarding_complete === undefined)
check('makes it the owner’s station, as the web does', db.writes.some((w) => w.table === 'users' && w.row.org_id === 'new-station' && w.where.id === 'owner-1'))
check('writes no subscription', !db.writes.some((w) => /subscri|service/.test(w.table)))

console.log('\nNames')
check('a taken slug gets a suffix', stationSlug('Kubwa', ['kubwa']) !== 'kubwa' && stationSlug('Kubwa', ['kubwa']).startsWith('kubwa-'))
check('a name with no letters is "station"', stationSlug('!!!', []) === 'station')
check('an empty name is refused', (await createOwnedStation(fakeDb(), { ownerId: 'o', name: '   ' })).error !== undefined)
check('a name over 100 characters is refused', (await createOwnedStation(fakeDb(), { ownerId: 'o', name: 'x'.repeat(101) })).error !== undefined)

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
