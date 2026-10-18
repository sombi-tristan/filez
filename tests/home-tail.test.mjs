/**
 * Pins the end of the station home, as the owner asked for it, and where Manage Station went:
 *
 *   Manage Station moved to the station's Settings screen, always open
 *   (components/station/ManageStation.js): setting up an unfinished station, renaming it and
 *   deleting it. Appearance, Leave Station and Sign out are a plain footer row at the very bottom.
 *
 * Run: node tests/home-tail.test.mjs
 */
import { readFileSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const home = read('screens/dashboard/stations/[stationId]/page.js')
const settings = read('screens/dashboard/stations/[stationId]/settings/page.js')
const manage = read('components/station/ManageStation.js')

console.log('Manage Station')
check('no longer on the station home', !home.includes('Manage Station') && !home.includes('setShowManage') && !home.includes('updateStation') && !home.includes('deleteStation'))
check('in Settings, in the Station tab', /import ManageStation(, \{ useStationOwner \})? from '@\/components\/station\/ManageStation'/.test(settings) && /title="Station"[^>]*>\s*(\{\/\*[^*]*\*\/\}\s*)?<ManageStation stationId=\{stationId\} \/>/.test(settings))
check('always open: no fold', !manage.includes('showManage') && !manage.includes('ChevronDown'))
// In the Settings tabs' Station tab now, whose box frames it: no frame of its own.
check('its heading inside, no frame of its own (the Station tab frames it)', /<section className="mb-4">\s*<h2[^>]*>Manage station<\/h2>/.test(manage))
check('only for the owner', manage.includes('owner_id') && /if \(!isOwner( \|\| !station)?\) return null/.test(manage))
check('sets up an unfinished station', manage.includes('!station.onboarding_complete') && manage.includes('href={`/dashboard/setup/${stationId}`}') && manage.includes('Set up this station'))
check('renames it, the name and the button on one line', manage.includes("method: 'PATCH'") && /<form onSubmit=\{rename\} className="flex items-end gap-2">/.test(manage))
check('deletes it, after asking', manage.includes("method: 'DELETE'") && manage.includes('confirm(') && manage.includes('Delete station'))

console.log('\nThe very bottom')
const tail = home.slice(home.indexOf('{/* The very bottom'))
check('Appearance, Leave Station and Sign out on one plain footer row', /<footer className="mt-8 pt-4 border-t border-line flex items-center justify-between gap-3 flex-wrap">[\s\S]*?Appearance[\s\S]*?<ThemeControl \/>[\s\S]*?Leave Station[\s\S]*?Sign out[\s\S]*?<\/footer>/.test(tail))
check('no separate Sign out section', !home.includes('<section className="mt-8 flex items-center gap-2 flex-wrap">'))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
