/**
 * Pins what the web answers a desktop push it refuses for a duplicate (lib/desktopConflicts.js,
 * app/api/desktop/push): the message names the real conflict, a pump or tank already on the web
 * station, not "Already recorded for that day" for everything.
 *
 * Run: node tests/desktop-conflicts.test.mjs
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { conflictMessage } = await import(pathToFileURL(resolve(__dirname, '..', 'lib', 'desktopConflicts.js')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
check('a pump names its fuel and number', /PMS 2/.test(conflictMessage('station_pumps', { fuel_type: 'PMS', pump_number: 2 })) && /already/i.test(conflictMessage('station_pumps', { fuel_type: 'PMS', pump_number: 2 })))
check('a tank names its fuel and number', /AGO tank 3/.test(conflictMessage('station_tanks', { fuel_type: 'AGO', tank_number: 3 })))
check('a second close of business names its day', /2026-10-05/.test(conflictMessage('daily_sales_entries', { entry_date: '2026-10-05' })) && /close of business/i.test(conflictMessage('daily_sales_entries', { entry_date: '2026-10-05' })))
check('anything else still says it is a duplicate', /already/i.test(conflictMessage('lodgement_entries', {})))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
