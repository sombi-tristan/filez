/**
 * Pins the design the desktop build has, on the website: the wallet (a solid blue card, round
 * white Push and Pull, a lighter band of chips), the Entries widgets (a white panel of small pale
 * squares), the text colours on entry and report screens, and a report's Load button.
 *
 * Source is read rather than rendered, like tests/solid-look.test.mjs.
 *
 * Run: node tests/web-look.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(resolve(root, ...p), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Wallet')
const wallet = read('components', 'StationWallet.js')
check('a solid blue card, no line', /<div className="relative bg-primary-600 text-white rounded-house mb-4">/.test(wallet))
check('the station\'s initial on a round badge', wallet.includes('station.name?.[0]') && /rounded-full bg-white\/20/.test(wallet))
check('Push and Pull are round white buttons', /const roundBtn = '[^']*w-11 h-11 rounded-full bg-white text-primary-600/.test(wallet) && (wallet.match(/className=\{roundBtn\}/g) || []).length === 2)
check('Push and Pull say what they are', wallet.includes('aria-label="Push"') && wallet.includes('aria-label="Pull"'))
check('a lighter band with the consolidation countdown as a chip', /bg-white\/15 rounded-house/.test(wallet) && /className=\{chip\}><Clock[^<]*\/>Next consolidation in/.test(wallet))
check('Clear queue is a chip in the band', /onClick=\{onClear\} className=\{`\$\{chip\}/.test(wallet))

console.log('\nStation home entry widgets')
const home = read('screens', 'dashboard', 'stations', '[stationId]', 'page.js')
const tiles = home.slice(home.indexOf('{entryLinks.length > 0 && ('), home.indexOf('{/* Reports: the ones'))
check('a white panel, its heading inside, full width', /<section className="w-full bg-surface border-card border-line rounded-house p-3">\s*<h2[^>]*>Entries<\/h2>/.test(tiles))
check('tiles fill the row in equal columns, 112px tall', tiles.includes('<div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-3">') && /const cls = `w-full h-28 flex flex-col items-center justify-center[^`]*text-center bg-subtle rounded-house/.test(tiles))
check('a soft blue round icon, the name under it, a short description', tiles.includes('<IconChip icon={link.icon} className="w-10 h-10"') && /<p className="[^"]*line-clamp-2[^"]*">\{link\.desc\}<\/p>/.test(tiles))
check('the icon circle shows in dark mode', /export const CHIP_MONO = '[^']*dark:bg-primary-500\/20/.test(read('components', 'ui', 'index.js')))

console.log('\nText on entry and report screens')
const shell = read('components', 'shell', 'Screen.js')
const css = read('app', 'globals.css')
check('entry and report screens carry screen-ink', shell.includes("'screen-ink'") && shell.includes("screen.path.startsWith('/dashboard/entries')"))
check('every word bold', /\.screen-ink,\s*\.screen-ink \*\s*\{\s*font-weight:\s*700/.test(css))
check('what was bold is Premeval orange', /\.screen-ink\s*\{\s*--bold-ink:\s*#f57d00/.test(css) && css.includes('.screen-ink :is(.font-bold, .font-semibold') && /\)\s*\{\s*color:\s*var\(--bold-ink\)/.test(css))
check('red, green, blue and white keep theirs', ['text-red', 'text-green', 'text-primary', 'text-white'].every((c) => css.includes(`[class*='${c}'] *`)))
check('labels are blue, brighter in dark', /\.screen-ink :is\(label, \.text-content-muted, \.text-content-faint\)\s*\{\s*color:\s*rgb\(var\(--primary-700\)\)/.test(css) && /\[data-theme='dark'\] \.screen-ink :is\(label, \.text-content-muted, \.text-content-faint\)\s*\{\s*color:\s*rgb\(var\(--primary-200\)\)/.test(css))
check('the day\'s entries list is blue', /\.entries-list\s*\{\s*color:\s*rgb\(var\(--primary-700\)\);\s*--bold-ink:\s*rgb\(var\(--primary-700\)\)/.test(css))
check('dark blue text one step brighter', ['400', '300', '200'].every((s) => css.includes(`[data-theme='dark'] .dark\\:text-primary-${s}`)))

console.log('\nA report\'s Load button')
const range = read('components', 'reports', 'DateRange.js')
check('Load, a text button the size of the others', /^\s*Load\s*$/m.test(range) && range.includes('px-3 py-2 text-sm font-medium') && !range.includes('refreshOutline'))
check('no report says Generate', ['analytics', 'audit-report', 'daily-sales-report', 'inventory-log', 'lube-report', 'product-received', 'sales-operation', 'sales-overview', 'summary']
  .every((n) => !read('screens', 'dashboard', 'reports', n, 'page.js').includes('click Generate')))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
