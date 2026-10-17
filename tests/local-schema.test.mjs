/**
 * Pins lib/local/schema.json to the migrations (scripts/gen-local-schema.mjs).
 *
 * The bug: the script read ADD and DROP COLUMN but not RENAME COLUMN, so migration 019's
 * `station_banks.balance -> opening_balance` never reached the desktop. Its banks kept a
 * `balance` column the web does not have, every bank was refused on push ("Could not find the
 * 'balance' column of 'station_banks'"), and the lodgements that point at them with it.
 *
 * Run: node tests/local-schema.test.mjs
 */
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const path = resolve(root, 'lib', 'local', 'schema.json')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const before = readFileSync(path, 'utf8')
const banks = JSON.parse(before).station_banks

console.log('\nRenamed columns')
check('banks have opening_balance', banks.columns.includes('opening_balance'))
check('banks no longer have balance', !banks.columns.includes('balance') && !('balance' in banks.defaults))

console.log('\nThe file matches the migrations')
execFileSync(process.execPath, ['scripts/gen-local-schema.mjs'], { cwd: root, stdio: 'ignore' })
const after = readFileSync(path, 'utf8')
check('regenerating changes nothing', after.replace(/\r\n/g, '\n') === before.replace(/\r\n/g, '\n'))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
