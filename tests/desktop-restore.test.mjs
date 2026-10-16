/**
 * Pins what the desktop app does with a backup and with a computer whose records belong to
 * another station (lib/local/restorePlan.js).
 *
 * The bug: restoring a backup of another station on a linked computer wiped this station's
 * records, left a station the computer could not find, and sent every sign-in back to the
 * sign-in screen. A backup of this station, or of this computer before it was linked, restores
 * into it; one of another station overwrites this computer and unlinks it, so the owner can
 * create (or link) that station on the web. A computer already in that state
 * is offered its way out at sign-in.
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
const { restorePlan, heldStation } = await import(pathToFileURL(resolve(tmp, 'restorePlan.mjs')).href)
const { LOCAL_STATION_ID } = await import(pathToFileURL(resolve(tmp, 'constants.mjs')).href)

let failures = 0
function check(name, ok) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

const B = 'station-b'
const A = 'station-a'
const backup = (...stations) => ({ tables: { organizations: stations.map(([id, name]) => ({ id, name })) } })

console.log('Restoring on a computer linked to B')
check('a backup of B restores as it is', (p => p.ok && !p.adoptFrom)(restorePlan(backup([B, 'Kubwa']), { stationId: B, linked: true })))
check('a backup from before linking moves into B', (p => p.ok && p.adoptFrom === LOCAL_STATION_ID)(restorePlan(backup([LOCAL_STATION_ID, 'Kubwa']), { stationId: B, linked: true })))
const other = restorePlan(backup([A, 'Wuse']), { stationId: B, linked: true })
check('a backup of another station restores, overwriting', other.ok === true)
check('its records move under the local id', other.adoptFrom === A && other.into === LOCAL_STATION_ID)
check('and the computer is unlinked from B, to create or link its own station', other.unlink === true)
check('a backup from before linking does not unlink', !restorePlan(backup([LOCAL_STATION_ID, 'Kubwa']), { stationId: B, linked: true }).unlink)

console.log('\nRestoring on a computer that is not linked')
check('its own backup restores as it is', (p => p.ok && !p.adoptFrom)(restorePlan(backup([LOCAL_STATION_ID, 'Kubwa']), { stationId: LOCAL_STATION_ID, linked: false })))
check('a linked station’s backup moves under the local id', (p => p.ok && p.adoptFrom === A)(restorePlan(backup([A, 'Wuse']), { stationId: LOCAL_STATION_ID, linked: false })))

console.log('\nNot a backup to restore')
check('one with no station is refused', restorePlan({ tables: { organizations: [] } }, { stationId: B, linked: true }).ok === false)
check('one with two stations is refused', restorePlan(backup([A, 'Wuse'], [B, 'Kubwa']), { stationId: LOCAL_STATION_ID, linked: false }).ok === false)

console.log('\nA computer already holding another station')
check('linked to B and holding B is fine', heldStation({ stationId: B, linked: true, stations: [{ id: B, name: 'Kubwa' }] }) === null)
check('linked to B and holding A is offered the way out', heldStation({ stationId: B, linked: true, stations: [{ id: A, name: 'Wuse' }] })?.id === A)
check('a fresh linked computer is not', heldStation({ stationId: B, linked: true, stations: [] }) === null)
check('a computer that is not linked is not', heldStation({ stationId: LOCAL_STATION_ID, linked: false, stations: [{ id: A, name: 'Wuse' }] }) === null)

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
