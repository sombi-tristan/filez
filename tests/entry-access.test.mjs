/**
 * Pins who may open the entry screens: the owner, or staff the owner gave the page
 * (components/AccessGate.js), as the reports already were. Each entry route in screens/routes.js
 * carries its permission key and components/shell/Screen.js wraps it in the gate. Offline, the
 * gate falls back to any permissions saved for the station (lib/hooks/usePageAccess.js).
 * And the lodgement entry has no Paste POS lines.
 *
 * Run: node tests/entry-access.test.mjs
 */
import { readFileSync, existsSync } from 'node:fs'

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Entry screens are gated')
const routes = read('screens/routes.js')
for (const key of ['daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments']) {
  const lines = routes.split(/\r?\n/).filter((l) => l.includes(`path: '/dashboard/entries/${key}'`) || l.includes(`path: '/dashboard/entries/${key}/list'`))
  check(`${key}: form and list carry pageKey '${key}'`, lines.length === 2 && lines.every((l) => l.includes(`pageKey: '${key}'`)))
}
const shell = read('components/shell/Screen.js')
check('Screen wraps a keyed screen in AccessGate', shell.includes("import AccessGate from '@/components/AccessGate'") && shell.includes('<AccessGate orgId={stationId} pageKey={screen.pageKey}><Page key={held.key} /></AccessGate>'))

console.log('\nOffline')
const hook = read('lib/hooks/usePageAccess.js')
check('falls back to the station\'s saved permissions from any page', hook.includes('db.accessCache.filter((c) => c.key.startsWith(`${orgId}:`)).first()') && hook.includes('setAllowed(cached.isOwner || pages.includes(pageKey))'))

console.log('\nNo Paste POS lines')
const lodgements = read('screens/dashboard/entries/lodgements/page.js')
check('the lodgement entry has no Paste POS lines', !/paste/i.test(lodgements) && !/bedbug/i.test(lodgements))
check('its parser is gone', !existsSync(new URL('../lib/posPaste.js', import.meta.url)))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
