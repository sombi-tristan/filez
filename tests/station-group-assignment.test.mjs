/**
 * Pins that the admin settings page speaks the post-054 station-group vocabulary.
 *
 * Migration 054 moved a station's group from `organizations.station_group` (TEXT name) to
 * `organizations.station_group_id` (uuid FK). The API moved with it: /api/admin/stations
 * selects `station_group_id, station_groups(name)` and never returns the old text column,
 * and PATCH /api/station-groups writes `station_group_id`.
 *
 * screens/admin/settings/page.js did not move. It bound the dropdown with
 *   groups.find((g) => g.name === station.station_group)?.id
 * against a field the API stopped sending, so the lookup resolved to undefined and the select
 * rendered "None" for every station however the group was actually set. The write reached the
 * database; only the screen lied. Its optimistic updates patched `station_group` too, so the
 * local copy drifted from the server on every assignment.
 *
 * Silent in every direction: no throw, no failed request, no console warning. A person picks a
 * group, the row snaps back to None, and nothing anywhere reports a fault. Hence a test.
 *
 * Reads the source rather than rendering it, matching the other tests here: the defect is which
 * field name is written, so a source assertion catches it with no DOM and no React runner.
 *
 * Run: node tests/station-group-assignment.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const read = (...p) => readFileSync(resolve(__dirname, '..', ...p), 'utf8')

const settings = read('screens', 'admin', 'settings', 'page.js')
const stationsApi = read('app', 'api', 'admin', 'stations', 'route.js')
const groupsApi = read('app', 'api', 'station-groups', 'route.js')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok || !detail ? '' : `\n        ${detail}`}`)
  if (!ok) failures++
}

// `station_group` not followed by `_id` — the stale text column.
const staleRefs = [...settings.matchAll(/station_group(?!_id)\b/g)]

check(
  'settings page never reads the pre-054 station_group text column',
  staleRefs.length === 0,
  `${staleRefs.length} reference(s) remain; the API does not send this field, so each is always undefined`,
)

check(
  'settings page binds the group select to station_group_id',
  /value=\{station\.station_group_id\s*\|\|\s*''\}/.test(settings),
  'the select value must come from the id the API returns, not a name lookup',
)

check(
  'assignGroup patches station_group_id optimistically',
  /station_group_id:\s*groupId\s*\|\|\s*null/.test(settings),
  'the optimistic update must write the same field the PATCH writes',
)

// Guards against the opposite regression: the API quietly going back to the text column.
check(
  'admin stations API still returns station_group_id',
  /station_group_id/.test(stationsApi),
  'app/api/admin/stations/route.js must select station_group_id',
)

check(
  'station-groups PATCH still writes station_group_id',
  /station_group_id:\s*group_id/.test(groupsApi),
  'app/api/station-groups/route.js PATCH must write station_group_id',
)

console.log(failures ? `\n${failures} failing` : '\nall passing')
process.exit(failures ? 1 : 0)
