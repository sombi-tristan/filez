/**
 * Pins that the station's Notifications are gone from the web and the Android app: no bell in
 * the top bar (components/shell/Screen.js), no Notifications screen or route, no unread hook.
 * Who did what is shown under each entry instead. The activity is still recorded
 * (lib/entryHelpers.js logActivity).
 *
 * Run: node tests/no-notifications.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const at = (path) => new URL(path, import.meta.url)
const screen = readFileSync(at('../components/shell/Screen.js'), 'utf8')
const routes = readFileSync(at('../screens/routes.js'), 'utf8')
const helpers = readFileSync(at('../lib/entryHelpers.js'), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Notifications removed')
check('no bell in the top bar', !screen.includes('notificationsOutline') && !screen.includes('Notifications'))
check('no unread count read there', !screen.includes('useStationUnread') && !screen.includes('<Badge'))
check('no Notifications route', !routes.includes('/notifications'))
check('no Notifications screen', !existsSync(at('../screens/dashboard/stations/[stationId]/notifications/page.js')))
check('no unread hook', !existsSync(at('../lib/useStationUnread.js')))
check('Home still in the top bar', screen.includes('icon={homeOutline} label="Home"'))
check('the activity is still recorded', helpers.includes('export async function logActivity('))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
