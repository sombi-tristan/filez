/**
 * Every screen, component and lib file compiles. The other tests read source as text, so a
 * syntax slip (two JSX elements where one belongs) passed them and only broke the build.
 * Parses each file with Next's own compiler (SWC), without building anything.
 *
 * Run: node tests/compiles.test.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { transform } = createRequire(import.meta.url)('next/dist/build/swc')

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return files(p)
    return /\.(js|jsx)$/.test(name) ? [p] : []
  })
}

let failures = 0
let count = 0
for (const dir of ['app', 'components', 'screens', 'lib']) {
  for (const f of files(resolve(root, dir))) {
    count++
    try {
      await transform(readFileSync(f, 'utf8'), {
        filename: f,
        jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
      })
    } catch (e) {
      failures++
      console.log(`  FAIL  ${relative(root, f)}\n${String(e.message || e).split('\n').slice(0, 6).join('\n')}`)
    }
  }
}

console.log(`\n${count} files, ${failures === 0 ? 'all compile' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
