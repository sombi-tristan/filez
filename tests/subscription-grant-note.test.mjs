/**
 * Pins the note that says a subscription was granted by the StationMGR team
 * (app/api/admin/grant-subscription). It is on the Subscription page with the countdown and the
 * expired / grace-period warning, not on the station home. A grant is the approved subscription
 * whose notes start "Granted by"; the page reads it from /api/dashboard/data, so that sends the notes.
 *
 * Run: node tests/subscription-grant-note.test.mjs
 */
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const data = read('../app/api/dashboard/data/route.js')
const home = read('../screens/dashboard/stations/[stationId]/page.js')
const page = read('../screens/dashboard/subscribe/page.js')
const grant = read('../app/api/admin/grant-subscription/route.js')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Granted subscription note')
check('a grant is marked in its notes', grant.includes('notes: `Granted by '))
check('the dashboard data sends the notes', /const SUB_COLS = '[^']*\bnotes\b/.test(data))
check('the Subscription page notes a grant on the approved subscription', /hasApproved \? \([\s\S]*subscription\.notes\?\.startsWith\('Granted by'\)/.test(page))
check('it says who granted it, from when, until when', page.includes('Granted by StationMGR on {fmtDate(subscription.start_date)}, active until {fmtDate(subscription.end_date)}.'))

console.log('\nCountdown and warnings, on the Subscription page only')
check('the days left, every day, orange in the last week', page.includes("({daysLeft} day{daysLeft === 1 ? '' : 's'} left)") && page.includes("daysLeft <= 7 ? 'text-orange-500"))
check('the expired / grace-period warning', page.includes('of grace period remaining') && page.includes('Subscription &amp; grace period expired'))
check('the station home shows none of it', !home.includes('Granted by StationMGR') && !home.includes('grace period remaining') && !home.includes('setSubscription'))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
