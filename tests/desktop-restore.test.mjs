/**
 * Pins that a station that cannot be opened says why on screen
 * (screens/dashboard/stations/[stationId]/page.js): only a signed-out person (401) goes back to
 * sign-in, so it cannot loop back there as 1.0.4 did. Restoring a backup is pinned by
 * tests/desktop-restore-into.test.mjs and tests/desktop-restore-route.test.mjs.
 *
 * Run: node tests/desktop-restore.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

let failures = 0
function check(name, ok) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

console.log('A station that cannot be opened')
const page = readFileSync(resolve(root, 'screens', 'dashboard', 'stations', '[stationId]', 'page.js'), 'utf8')
const redirects = page.match(/router\.replace\('\/auth\/login'\)/g) || []
check('goes back to sign-in only when signed out, or on Sign out', redirects.length === 2 && page.includes("orgRes.status === 401) { router.replace('/auth/login')"))
check('shows the reason instead', page.includes('This station could not be opened'))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
