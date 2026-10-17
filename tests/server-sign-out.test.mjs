/**
 * The bug: the desktop's sign-in and link routes prove the password with signInWithPassword, then
 * end that session with signOut(). supabase-js signs out globally by default, which revokes every
 * session the account has: each sign-in on a computer signed the owner's phone (the PWA) out, so
 * it asked for the login again whenever it was opened.
 *
 * Every server-side sign-out after a password check ends only its own session.
 *
 * Run: node tests/server-sign-out.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const FILES = ['app/api/desktop/sign-in/route.js', 'app/api/desktop/link/route.js', 'lib/desktopAccount.js']

console.log('\nServer sign-outs after a password check')
for (const file of FILES) {
  const code = readFileSync(resolve(root, file), 'utf8')
  const calls = [...code.matchAll(/\.auth\.signOut\??\.?\(([^)]*)\)/g)].map((m) => m[1].trim())
  check(`${file}: signs out (${calls.length})`, calls.length > 0)
  check(`${file}: only its own session`, calls.every((args) => /scope:\s*'local'/.test(args)))
}

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
