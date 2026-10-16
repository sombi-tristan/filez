/**
 * Has this copy of the design system drifted from the one it was taken from?
 *
 * `design/manifest.json` (written by sync.mjs) holds a hash of every file as it was copied.
 * This compares the files here against it: one that was edited, one that is missing, and one
 * that was added here all count, because a component is changed in the design system's own
 * repository and synced, never in an app's copy.
 *
 *   node design/check.mjs            prints what drifted and exits 1, or exits 0
 *   import { drift } from './design/check.mjs'    in an app's own tests:
 *       test('the design system copy is untouched', () => assert.deepEqual(drift(), []))
 *
 * Line endings are ignored: git on Windows rewrites them on checkout.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

// Written by the sync, or only meaningful where the system lives: never part of the copy.
export const NOT_COPIED = new Set(['manifest.json', 'sync.mjs'])

export function hashOf(file) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(text).digest('hex')
}

/** Every file under `dir`, as paths relative to it with forward slashes. */
export function filesIn(dir, under = '') {
  return readdirSync(path.join(dir, under))
    .flatMap((name) => {
      const rel = under ? `${under}/${name}` : name
      return statSync(path.join(dir, rel)).isDirectory() ? filesIn(dir, rel) : [rel]
    })
    .filter((rel) => !NOT_COPIED.has(rel))
    .sort()
}

/** What has drifted, as sentences; an empty list is a clean copy. */
export function drift(dir = HERE) {
  const manifestFile = path.join(dir, 'manifest.json')
  if (!existsSync(manifestFile)) return ['manifest.json is missing: this copy was not made by sync.mjs']
  const { files } = JSON.parse(readFileSync(manifestFile, 'utf8'))
  const found = []
  for (const [rel, hash] of Object.entries(files)) {
    const file = path.join(dir, rel)
    if (!existsSync(file)) found.push(`${rel} is missing`)
    else if (hashOf(file) !== hash) found.push(`${rel} was changed here`)
  }
  for (const rel of filesIn(dir)) {
    if (!(rel in files)) found.push(`${rel} was added here`)
  }
  return found
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = drift()
  if (found.length) {
    console.error(`The design system copy has drifted:\n${found.map((line) => `  ${line}`).join('\n')}\nChange it in the design system's own repository, then sync again.`)
    process.exit(1)
  }
  console.log('The design system copy is untouched.')
}
