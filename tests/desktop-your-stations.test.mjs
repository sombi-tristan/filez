/**
 * Pins the desktop's Your stations screen (screens/dashboard/page.js) to the web's
 * (screens/dashboard/page.js on main): a welcome with the person's name and email, My Stations
 * and Stations I've Joined apart, each card with its address, Add a station for everyone signed
 * in, Subscribe and Help & feedback (on the web, in the browser) and Sign out. The desktop keeps
 * its own line saying whether a station is linked to the web. Switch station
 * (components/desktop/StationSwitch.js) shows each station's address too.
 *
 * Run: node tests/desktop-your-stations.test.mjs
 */
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('../screens/dashboard/page.js', import.meta.url), 'utf8')
const sw = readFileSync(new URL('../components/desktop/StationSwitch.js', import.meta.url), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Your stations')
check('welcome with the name, and the email under it', page.includes("fetch('/api/dashboard/data')") && page.includes('Welcome, {profile?.name}') && page.includes('{profile?.email}'))
check('My Stations and Stations I\'ve Joined apart', page.includes('My Stations') && page.includes('Stations I&apos;ve Joined') && page.indexOf('My Stations') < page.indexOf('Stations I&apos;ve Joined'))
check('a card shows the address', (page.match(/station\.location && <p className="text-xs text-content-muted">\{station\.location\}<\/p>/g) || []).length === 1 && page.includes('function StationCard('))
check('and still whether it is linked', page.includes("getLink(station.id) ? 'Linked to the web' : 'On this computer only'"))
check('Add a station for everyone signed in, as on the web', page.includes('Add a station') && !page.includes('isOwner && !adding'))
check('Subscribe opens the web\'s page in the browser', page.includes("openWeb('/dashboard/subscribe')"))
check('Help & feedback too', page.includes("openWeb('/dashboard/feedback')") && page.includes('Help &amp; feedback'))
check('Sign out, as on the web', page.includes('supabase.auth.signOut()') && page.includes("router.replace('/auth/login')") && /<LogOut className="w-4 h-4" \/>\s*Sign out/.test(page))

console.log('\nInvites waiting on the web')
const accounts = readFileSync(new URL('../lib/local/accounts.js', import.meta.url), 'utf8')
check('the person\'s invites as of their last sign-in', accounts.includes('export async function myPendingInvites()') && /getSessionUserId\(\)[\s\S]*pending_invites/.test(accounts.slice(accounts.indexOf('export async function myPendingInvites()'))))
check('shown above the stations, as on the web', page.includes('myPendingInvites().then(setInvites)') && page.indexOf('You&apos;ve been invited to join') < page.indexOf('>My Stations</h2>'))
check('each names its station', page.includes('<strong>{inv.stationName}</strong>'))
check('Accept opens the web, where it is accepted', page.includes("openWeb('/dashboard/invites')") && page.includes('Accept on the web'))
check('and says it shows here after the next sign-in', page.includes('sign out and in again'))

console.log('\nSwitch station')
check('each station shows its address', sw.includes('{s.location && <span className="block truncate text-xs text-content-muted">{s.location}</span>}'))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
