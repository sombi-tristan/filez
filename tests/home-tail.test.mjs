/**
 * Pins the end of the station home, as the owner asked for it, and where Manage Station went:
 *
 *   Manage Station moved to the station's Settings screen, always open
 *   (components/station/ManageStation.js): setting up an unfinished station, and renaming it.
 *   "This computer" is a full-width panel like the others, Back up and Restore as list cards.
 *   Appearance and Sign out are a plain footer row at the very bottom.
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
const computer = read('components/ThisComputer.js')

console.log('Manage Station')
check('no longer on the station home', !home.includes('Manage Station') && !home.includes('setShowManage') && !home.includes('updateStation'))
check('at the top of Settings', settings.includes("import ManageStation from '@/components/station/ManageStation'") && settings.indexOf('<ManageStation stationId={stationId} />') < settings.indexOf('<StationSwitch'))
check('always open: no fold', !manage.includes('showManage') && !manage.includes('ChevronDown'))
// In the Settings tabs' Station tab now, whose box frames it: no frame of its own.
check('its heading inside, no frame of its own (the Station tab frames it)', /<section className="mb-4">\s*<h2[^>]*>Manage station<\/h2>/.test(manage))
check('only for the owner', manage.includes('owner_id') && /if \(!isOwner\) return null/.test(manage))
check('sets up an unfinished station', manage.includes('!station.onboarding_complete') && manage.includes('href={`/dashboard/setup/${stationId}`}') && manage.includes('Set up this station'))
check('renames it, the name and the button on one line', manage.includes("method: 'PATCH'") && /<form onSubmit=\{rename\} className="flex items-end gap-2">/.test(manage))

console.log('\nThis computer')
check('a full-width panel with its heading inside', /<section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">\s*<h2[^>]*>This computer<\/h2>/.test(computer))
check('Back up and Restore as list cards side by side', computer.includes('grid grid-cols-1 sm:grid-cols-2 gap-3') && (computer.match(/LIST_CARD/g) || []).length >= 3)

console.log('\nThe very bottom')
const tail = home.slice(home.indexOf('<ThisComputer'))
check('Appearance and Sign out on one plain footer row', /<footer className="mt-8 pt-4 border-t border-line flex items-center justify-between gap-3 flex-wrap">[\s\S]*?Appearance[\s\S]*?<ThemeControl \/>[\s\S]*?Sign out[\s\S]*?<\/footer>/.test(tail))
check('no separate Sign out section', !tail.includes('<section className="mt-8 flex items-center gap-2 flex-wrap">'))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
