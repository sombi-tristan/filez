/**
 * Pins the web pages a computer's browser still opens (lib/platform.js COMPUTER_PATHS; every
 * other dashboard page shows the download page there). The desktop app opens Subscribe, Help &
 * feedback and Invites on the web, so those three must open; the station list must not.
 * And Invites (screens/dashboard/invites) is only the pending invites, with Accept.
 *
 * Run: node tests/computer-paths.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => (existsSync(new URL(path, import.meta.url)) ? readFileSync(new URL(path, import.meta.url), 'utf8') : '')
const platform = read('../lib/platform.js')
const routes = read('../screens/routes.js')
const invites = read('../screens/dashboard/invites/page.js')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const kept = JSON.parse((platform.match(/export const COMPUTER_PATHS = (\[[^\]]*\])/)?.[1] || '[]').replace(/'/g, '"'))

console.log('Pages a computer opens')
check('Subscribe', kept.includes('/dashboard/subscribe'))
check('Linked computers', kept.includes('/dashboard/computers'))
check('Help & feedback, opened from the desktop app', kept.includes('/dashboard/feedback'))
check('Invites, opened from the desktop app', kept.includes('/dashboard/invites'))
check('not the station list', !kept.includes('/dashboard'))

console.log('\nInvites page')
check('it has a route', routes.includes("{ path: '/dashboard/invites', title: 'Invites', Page: lazy(() => import('@/screens/dashboard/invites/page')) }"))
check('it lists the pending invites', invites.includes("fetch('/api/invites')") && invites.includes('inv.organizations?.name'))
check('Accept accepts one, as the dashboard does', invites.includes("fetch('/api/invites/accept'") && invites.includes('invite_id: inviteId'))
check('a failed accept shows why, on the page', invites.includes("setError(") && !invites.includes('alert('))
check('then says to sign in again on the desktop app', invites.includes('sign out and in again'))
check('with nothing waiting, it says so', invites.includes('No invites waiting'))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
