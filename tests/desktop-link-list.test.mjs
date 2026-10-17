/**
 * Pins that linking a StationMGR Desktop station always lets the owner choose
 * (app/api/desktop/link): after the password the web lists every station they own, even one,
 * and links only the one picked (stationId) or a new one (createName); it never links on its own.
 *
 * Run: node tests/desktop-link-list.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const route = readFileSync(resolve(__dirname, '..', 'app', 'api', 'desktop', 'link', 'route.js'), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
check('a single station is not linked without being picked', !/stations\.length === 1 \? stations\[0\]/.test(route))
check('only the one picked, or a new one, is linked', /const chosen = created \|\| \(stationId \? stations\.find\(\(s\) => s\.id === stationId\) : null\)/.test(route))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
