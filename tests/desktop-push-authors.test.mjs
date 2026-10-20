/**
 * Pins who a desktop push says added and last edited an entry (app/api/desktop/push): people on
 * a computer sign in with their web account, so a row's created_by and updated_by are kept when
 * they are web accounts, and fall to the owner who linked the computer only when they are not
 * (an old PIN account). An entry never edited keeps updated_by empty.
 *
 * Run: node tests/desktop-push-authors.test.mjs
 */
import { readFileSync } from 'node:fs'

const push = readFileSync(new URL('../app/api/desktop/push/route.js', import.meta.url), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Who, on a pushed entry')
check('the web accounts among the authors are looked up once per push', /const known = new Set\(\(await supabase\.from\('users'\)\.select\('id'\)\.in\('id', authors\)\)\.data/.test(push) && push.indexOf('const known') < push.indexOf('for (const change of changes)'))
check('who added it is kept when a web account', push.includes("if ('created_by' in row) row.created_by = known.has(row.created_by) ? row.created_by : linked.user.id"))
check('who last edited it too', push.includes('if (row.updated_by) row.updated_by = known.has(row.updated_by) ? row.updated_by : linked.user.id'))
check('no longer everyone as the owner', !push.includes("if ('created_by' in row) row.created_by = linked.user.id"))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
