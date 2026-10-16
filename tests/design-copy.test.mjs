/**
 * Pins that design/ is an untouched copy of the house design system.
 *
 * design/ is synced from the groo repository (node design/sync.mjs ../filez, run from groo) and
 * carries a manifest with a hash of every file. A change made here instead of in groo is lost
 * at the next sync, and it makes this app quietly diverge from every other app on the system,
 * so it fails here. Change the system in groo, then sync again.
 *
 * Run: node tests/design-copy.test.mjs
 */
import { drift } from '../design/check.mjs'

const found = drift()
for (const line of found) console.log(`  FAIL  ${line}`)
console.log(found.length === 0 ? 'The design system copy is untouched' : `\n${found.length} drifted`)
process.exit(found.length === 0 ? 0 : 1)
