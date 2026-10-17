/**
 * Pins how a linked StationMGR Desktop computer replaces its web station's copy
 * (lib/desktopWipe.js, used by app/api/desktop/wipe): the station on the computer is the
 * source of truth when it corrects something, so the web station's records are cleared and the
 * computer pushes all of its own.
 *
 * Every synced table but the station row itself is cleared for that station only, entries
 * before the setup they point at (a pump before its tank), with nothing kept as a soft delete
 * (a kept close of business would refuse the computer's own for that day).
 *
 * Run: node tests/desktop-wipe.test.mjs
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { wipeStation } = await import(pathToFileURL(resolve(__dirname, '..', 'lib', 'desktopWipe.js')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const asked = []
const db = {
  from(table) {
    return {
      delete() {
        return { eq: async (col, val) => { asked.push({ table, col, val }); return { error: null } } }
      },
    }
  },
}
const ORDER = ['organizations', 'station_tanks', 'station_pumps', 'station_banks', 'daily_sales_entries', 'lodgement_entries']

const res = await wipeStation(db, 'kubwa', ORDER)
check('clears every table of the station', asked.map((a) => a.table).sort().join() === ORDER.filter((t) => t !== 'organizations').sort().join())
check('keeps the station itself', !asked.some((a) => a.table === 'organizations'))
check('only that station', asked.every((a) => a.col === 'org_id' && a.val === 'kubwa'))
check('entries before setup, pumps before their tanks', asked.findIndex((a) => a.table === 'daily_sales_entries') < asked.findIndex((a) => a.table === 'station_pumps') && asked.findIndex((a) => a.table === 'station_pumps') < asked.findIndex((a) => a.table === 'station_tanks'))
check('says it worked', res.ok === true)

const failing = { from: (table) => ({ delete: () => ({ eq: async () => ({ error: table === 'station_pumps' ? { message: 'blocked' } : null }) }) }) }
const bad = await wipeStation(failing, 'kubwa', ORDER)
check('a table that will not clear stops it and says which', bad.ok === false && /station_pumps/.test(bad.error))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
