/**
 * Pins the note on the station home that says a subscription was granted by the StationMGR team
 * (app/api/admin/grant-subscription), now that the Notifications screen that told the owner is
 * gone. A grant is the approved subscription whose notes start "Granted by"; the home reads it
 * from /api/dashboard/data, so that sends the notes.
 *
 * Run: node tests/subscription-grant-note.test.mjs
 */
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const data = read('../app/api/dashboard/data/route.js')
const home = read('../screens/dashboard/stations/[stationId]/page.js')
const grant = read('../app/api/admin/grant-subscription/route.js')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Granted subscription note')
check('a grant is marked in its notes', grant.includes('notes: `Granted by '))
check('the dashboard data sends the notes', /const SUB_COLS = '[^']*\bnotes\b/.test(data))
check('the home knows a grant when it sees one', home.includes("subscription?.status === 'approved' && subscription?.notes?.startsWith('Granted by')"))
check('only the owner sees it', home.includes('{isOwner && granted && ('))
check('it says who granted it, from when, until when', home.includes('Subscription granted by StationMGR on {fmtDate(subscription.start_date)}') && home.includes('active until {fmtDate(subscription.end_date)}'))
check('it sits under the All Stations and Subscription row', home.indexOf('{isOwner && granted && (') > home.indexOf('Subscription\n          </Button>\n        </div>'))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
