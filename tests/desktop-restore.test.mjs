/**
 * Pins what restoring a backup does on a computer that holds several stations
 * (lib/local/restorePlan.js): the backup is one station, and it is added beside the others or
 * replaces only that same station. Nothing is ever merged into a different station, so its
 * pumps, tanks and opening balances come in exactly once, as they are in the backup.
 *
 * The bugs behind it: a backup of another station wiped the computer and looped sign-in
 * (1.0.2), and a backup of a station made offline was merged into the linked station, which
 * doubled every pump and tank in the entries (1.0.3 to 1.0.5).
 *
 * Run: node tests/desktop-restore.test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const tmp = resolve(root, 'node_modules', '.cache', 'desktop-restore-test')
mkdirSync(tmp, { recursive: true })
for (const name of ['restorePlan', 'constants']) {
  const src = readFileSync(resolve(root, 'lib', 'local', `${name}.js`), 'utf8').replace(/from '\.\/(\w+)'/g, "from './$1.mjs'")
  writeFileSync(resolve(tmp, `${name}.mjs`), src)
}
const { restorePlan } = await import(pathToFileURL(resolve(tmp, 'restorePlan.mjs')).href)
const { LOCAL_STATION_ID: LOCAL } = await import(pathToFileURL(resolve(tmp, 'constants.mjs')).href)

let failures = 0
function check(name, ok) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

const backup = (id, pumps = []) => ({
  tables: { organizations: [{ id, name: 'Lucky Way' }], station_pumps: pumps.map((p) => ({ id: p, org_id: id })) },
})

console.log('A station not on this computer')
let p = restorePlan(backup('web-a', ['p1']), { here: [{ id: 'web-b', pumps: ['q1'] }] })
check('is added beside the others', p.ok && p.into === 'web-a' && !p.replace && !p.fresh)

console.log('\nThe same station, already here')
p = restorePlan(backup('web-a', ['p1']), { here: [{ id: 'web-a', pumps: ['p1', 'p2'] }] })
check('replaces only that station', p.ok && p.into === 'web-a' && p.replace)
p = restorePlan(backup(LOCAL, ['p1']), { here: [{ id: LOCAL, pumps: ['p1'] }] })
check('made offline, with its own pumps, replaces it too', p.ok && p.into === LOCAL && p.replace)
p = restorePlan(backup(LOCAL, ['p1']), { here: [{ id: LOCAL, pumps: [] }] })
check('replaces a station here that has no setup yet', p.ok && p.into === LOCAL && p.replace)

console.log('\nA different station made offline (both under the local id)')
p = restorePlan(backup(LOCAL, ['p1']), { here: [{ id: LOCAL, pumps: ['x1', 'x2'] }] })
check('is added under a new id, not merged', p.ok && p.fresh && !p.replace)
p = restorePlan(backup(LOCAL, ['p1']), { here: [{ id: LOCAL, pumps: ['x1'] }, { id: 'added-before', pumps: ['p1'] }] })
check('restored again, it replaces the copy added before', p.ok && p.into === 'added-before' && p.replace)

console.log('\nNot a backup to restore')
check('one with no station is refused', restorePlan({ tables: { organizations: [] } }, { here: [] }).ok === false)
check('one with two stations is refused', restorePlan({ tables: { organizations: [{ id: 'a' }, { id: 'b' }] } }, { here: [] }).ok === false)

console.log('\nA station that cannot be opened')
// It says why on screen; only a signed-out person (401) goes back to sign-in, so it cannot loop.
{
  const page = readFileSync(resolve(root, 'screens', 'dashboard', 'stations', '[stationId]', 'page.js'), 'utf8')
  const redirects = page.match(/router\.replace\('\/auth\/login'\)/g) || []
  check('goes back to sign-in only when signed out, or on Sign out', redirects.length === 2 && page.includes("orgRes.status === 401) { router.replace('/auth/login')"))
  check('shows the reason instead', page.includes('This station could not be opened'))
}

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
