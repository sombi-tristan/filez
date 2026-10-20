/**
 * Pins the names a desktop pull sends with the station's rows (app/api/desktop/pull): everyone
 * named as having added or edited a row ({ id, name }, nothing else), so the computer can say
 * who did an entry made on a phone. users never syncs; these are names only.
 *
 * Run: node tests/desktop-pull-people.test.mjs
 */
import { readFileSync } from 'node:fs'

const pull = readFileSync(new URL('../app/api/desktop/pull/route.js', import.meta.url), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('People on a pull')
check('everyone named on the rows', /const named = \[\.\.\.new Set\(Object\.values\(rows\)\.flat\(\)\.flatMap\(\(r\) => \[r\?\.created_by, r\?\.updated_by\]\)/.test(pull))
check('their id and name only', pull.includes(".from('users').select('id, name').in('id', named)"))
check('sent with the rows', /return NextResponse\.json\(\{ station: [^}]+\}, rows, people,/.test(pull))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
