/**
 * Pins Station Settings as tabs instead of accordions (screens/dashboard/stations/[stationId]/
 * settings): one tab per section, drawn from the sections' own titles, icons and counts, and only
 * the chosen section shown. Save stays under them and saves every section.
 *
 * Run: node tests/settings-tabs.test.mjs
 */
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../screens/dashboard/stations/[stationId]/settings/page.js', import.meta.url), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const SECTIONS = ['Station', 'Location', 'Nozzles', 'Underground Tanks', 'Tank to Nozzle Mapping', 'Lodgements', 'Lube Products', 'Accounts']

console.log('Station Settings')
check('no accordions left', !page.includes('Accordion'))
check('a tab bar', page.includes('function Tabs(') && page.includes('role="tablist"') && page.includes('role="tab"') && page.includes('aria-selected='))
check('one tab per section, from the sections themselves', SECTIONS.every((t) => new RegExp(`<Pane icon=\\{\\w+\\} title="${t}"`).test(page)))
check('every section is inside the tabs, Station first', page.indexOf('<Tabs>') < page.indexOf('title="Station"') && page.indexOf('title="Station"') < page.indexOf('title="Location"') && page.indexOf('title="Accounts"') < page.indexOf('</Tabs>'))
check('the part above the tabs is the Station tab now', page.indexOf('<ManageStation stationId={stationId} />') > page.indexOf('title="Station"') && page.indexOf('<ManageStation stationId={stationId} />') < page.indexOf('title="Location"'))
check('the tabs are a column down the left, the section beside them, as a second sidebar', page.includes('role="tablist" aria-orientation="vertical"') && /<div className="flex items-start gap-3">\s*<div role="tablist"/.test(page) && page.includes('<div className="flex-1 min-w-0">{current}</div>'))
check('on a phone a tab is its icon and count, its label from a computer up, still named for a screen reader', page.includes('<span className="hidden sm:inline flex-1">{title}</span>') && page.includes('aria-label={title}'))
check('a tab label never wraps', /role="tab"[\s\S]*?whitespace-nowrap/.test(page) && !page.includes('flex-col items-center justify-center gap-1'))
check('Station tab: the owner manages it; staff cannot open Settings', page.includes('<Pane icon={Building2} title="Station" hidden={!isOwner}>') && page.includes('const access = useStationAccess(stationId)') && page.includes('Only the station owner can open Settings.'))
check('the page is full width', /return \(\s*<div className="w-full px-4 sm:px-8 py-8">/.test(page) && !page.includes('max-w-lg px-4 sm:px-8 py-8'))
check('only the chosen section shows', /\{current\}/.test(page))
check('Save stays under the tabs', page.indexOf('</Tabs>') < page.indexOf('onClick={handleSave}'))
check('Save sticks to the bottom of the screen', /<div className="sticky bottom-0[^"]*">[\s\S]*?onClick=\{handleSave\}/.test(page))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
