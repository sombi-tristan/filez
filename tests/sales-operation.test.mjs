/**
 * Pins the Sales Operation report's place and look (screens/dashboard/reports/sales-operation):
 *
 *   Rainoil only: it is Rainoil's own form, so a station outside the RAINOIL group
 *   (lib/exportGroup.js) neither lists it (sidebar, station home, staff permissions) nor opens it.
 *   The sheet sits at 70% of the box holding it, centred, and is always light: no dark mode.
 *
 * Run: node tests/sales-operation.test.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./helpers/app-loader.mjs', import.meta.url)
const nav = await import('../lib/stationNav.js')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const KEY = 'report-sales-operation'
const keysIn = (sections) => sections.flatMap((s) => (s.links || s.items || []).map((l) => l.pageKey))

console.log('Listed only for Rainoil stations')
check('marked Rainoil only', nav.REPORT_LINKS('x').find((l) => l.pageKey === KEY)?.rainoilOnly === true)
check('not in the sidebar of another group\'s station', !keysIn(nav.buildStationNav('x', { isOwner: true, groupName: 'Other Group' })).includes(KEY))
check('not in the sidebar of a station with no group', !keysIn(nav.buildStationNav('x', { isOwner: true })).includes(KEY))
check('in the sidebar of a Rainoil station', keysIn(nav.buildStationNav('x', { isOwner: true, groupName: ' rainoil ' })).includes(KEY))
check('not on another station\'s home', !keysIn(nav.REPORT_SECTIONS('x', 'Other Group')).includes(KEY))
check('on a Rainoil station\'s home', keysIn(nav.REPORT_SECTIONS('x', 'RAINOIL')).includes(KEY))
check('not offered in another station\'s staff permissions', !nav.reportPermissionOptions('Other Group').some((o) => o.key === KEY))
check('offered in a Rainoil station\'s', nav.reportPermissionOptions('RAINOIL').some((o) => o.key === KEY))
check('the other reports are untouched', keysIn(nav.REPORT_SECTIONS('x', 'Other Group')).length === nav.REPORT_LINKS('x').length - 1)

console.log('\nThe screens pass the station\'s group')
check('the sidebar', read('components/StationSidebar.js').includes('groupName: current?.station_group'))
const home = read('screens/dashboard/stations/[stationId]/page.js')
check('station home', home.includes('REPORT_SECTIONS(stationId, station?.station_group)') && home.includes('reportPermissionOptions(station?.station_group)'))

const page = read('screens/dashboard/reports/sales-operation/page.js')
console.log('\nOpened on another station')
check('says it is for Rainoil stations, and shows no sheet', page.includes('isRainoilGroup(stationGroup)') && page.includes('This report is for Rainoil stations.'))

console.log('\nThe sheet')
// The box follows the theme and pads the sheet; only the sheet is light. The sheet is never
// narrower than its table at its narrowest (min-content: long figures do not wrap, and the
// report's text is a size up), or the table spills out of it to the right and it looks off
// centre; wider than the box, the box scrolls instead.
check('the box follows the theme, with padding round the sheet', /<div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 mb-3 p-4 border border-line rounded-house">/.test(page) && !/<div className="sheet-light flex-1/.test(page))
check('the sheet: 70% of the box, centred, never narrower than its table, light', /<div className="sheet-light w-\[70%\] min-w-min mx-auto">/.test(page))
check('squeezes to fit rather than holding 1100px, down to 700px', page.includes('className="w-full border-collapse text-xs min-w-[700px]"') && !page.includes('min-w-[1100px]'))
check('its columns keep their proportions', !/<col style=\{\{ width: \d+ \}\}/.test(page) && /<col style=\{\{ width: '[\d.]+%' \}\}/.test(page))
const css = read('app/globals.css')
const light = css.match(/\.sheet-light\s*\{([^}]*)\}/)?.[1] || ''
check('always light: white, dark text, light lines', ['--surface: 255 255 255', '--content: 15 20 25', '--line-ch: 207 217 222', 'color-scheme: light'].every((v) => light.includes(v)) && /background-color:\s*#fff/.test(light))
check('its bold text stays black, as on the form', /--bold-ink:\s*rgb\(15 20 25\)/.test(light))

console.log('\nAt most 32 days, like the audit report')
check('Load greys out over 32 days', /disabled=\{!startDate \|\| !endDate \|\| startDate > endDate \|\| rangeDays\(startDate, endDate\) > MAX_DAYS\}/.test(page) && page.includes('const MAX_DAYS = 32'))
check('a line under the dates says so', page.includes('Date range cannot exceed {MAX_DAYS} days ({rangeDays(startDate, endDate)} days selected).'))
check('and Load itself refuses a longer range', /const handleGenerate = \(\) => \{[\s\S]{0,200}if \(rangeDays\(s, e\) > MAX_DAYS\) return/.test(page))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
