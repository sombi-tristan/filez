/**
 * Pins where a report's strip of day (or sheet) tabs starts (lib/dayTabs.js), as the Daily
 * Sales Report and Sales Operation show it.
 *
 * The bug: after generating 1 to 5 October while 17 October was the day shown, the old day was
 * not in the new report (index -1) and the strip was set to start at -1, which shows only the
 * last tab: the report seemed to hold one date, and the back arrow was disabled.
 *
 * Run: node tests/day-tabs.test.mjs
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { tabOffsetFor } = await import(pathToFileURL(resolve(__dirname, '..', 'lib', 'dayTabs.js')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('A day that is not in the report (yet)')
check('leaves the strip at its start, never before it', tabOffsetFor({ index: -1, offset: 0, count: 31 }) === 0)
check('and mends a strip left before its start', tabOffsetFor({ index: -1, offset: -1, count: 31 }) === 0)

console.log('\nThe day shown')
check('in view: the strip stays', tabOffsetFor({ index: 3, offset: 0, count: 31 }) === 0)
check('before the strip: it moves back to it', tabOffsetFor({ index: 2, offset: 5, count: 14 }) === 2)
check('after the strip: it moves on to show it last', tabOffsetFor({ index: 20, offset: 0, count: 14 }) === 7)

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
