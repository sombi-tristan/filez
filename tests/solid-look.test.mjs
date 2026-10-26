/**
 * Pins the solid look: filled elements with a thin line and 8px corners, in place of the 2px
 * outlines and square corners. StationMGR only: the design system (design/, groo) keeps its own
 * 4px corner and 2px edge, and app/globals.css overrides them here.
 *
 * Source is read rather than rendered, like tests/screen-fit.test.mjs.
 *
 * Run: node tests/solid-look.test.mjs
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

console.log('Corners and lines')
const tw = read('tailwind.config.js')
const css = read('app', 'globals.css')
check('rounded-house is 8px', /house:\s*'8px'/.test(tw))
check('border-card is 1px', /card:\s*'1px'/.test(tw))
// app/layout.js loads design/house.css after globals.css, so a plain :root here would lose.
const override = css.match(/:root:root\s*\{([^}]*)\}/)?.[1] || ''
check('the house corner is 8px here, outranking house.css', /--corner:\s*8px/.test(override))
check('the house edge is 1px here', /--edge:\s*1px/.test(override))
check('the design system itself is untouched', /--corner:\s*4px/.test(read('design', 'house.css')))

console.log('\nShared styles (components/ui)')
const ui = read('components', 'ui', 'index.js')
const style = (name) => {
  const m = ui.match(new RegExp(`export const ${name} = (['\`])([^'\`]*)\\1`))
  return (m?.[2] || '').replace(/\$\{(\w+)\}/g, (_, ref) => style(ref))
}
const NAMES = ['CARD_LINE', 'CARD', 'OUTLINE', 'BTN_FRAMED', 'BTN_PRIMARY', 'BTN_DANGER', 'REPORT_CARD', 'INPUT_BASE', 'INPUT_BARE', 'FIELD', 'OUTLINE_WITHIN']
for (const name of NAMES) {
  const s = style(name)
  check(`${name}: no 2px outline, house corners`, s && !/\bborder(-b|-t)?-2\b/.test(s) && s.includes('rounded-house'))
}
check('fields have half corners (4px)', ['INPUT_BASE', 'INPUT_BARE', 'FIELD', 'OUTLINE_WITHIN'].every((n) => style(n).includes('rounded-house-field')) && /'house-field':\s*'4px'/.test(tw))
check('buttons have half corners (4px), cards the full 8px',
  ['BTN_FRAMED', 'BTN_PRIMARY', 'BTN_DANGER'].every((n) => style(n).includes('rounded-house-btn')) &&
  NAMES.filter((n) => !n.startsWith('BTN_')).every((n) => !style(n).includes('rounded-house-btn')) &&
  /'house-btn':\s*'4px'/.test(tw))
check('cards are filled', style('CARD').includes('bg-subtle'))
check('the main button is solid blue with white text', /\bbg-primary-600\b/.test(style('BTN_PRIMARY')) && style('BTN_PRIMARY').includes('text-white'))
check('the danger button is solid red with white text', /\bbg-red-600\b/.test(style('BTN_DANGER')) && style('BTN_DANGER').includes('text-white'))
check('other buttons are a solid light blue with a line', /\bbg-primary-500\/\d+/.test(style('BTN_FRAMED')) && /\bborder\b/.test(style('BTN_FRAMED')))
check('fields are filled boxes, not underlines', ['INPUT_BASE', 'FIELD', 'OUTLINE_WITHIN'].every((n) => /\bbg-primary-500\/\d+/.test(style(n)) && /(^|\s)border(\s|$)/.test(style(n))))
check('no report rule is 2px', !/\bborder-t-2\b/.test(style('REPORT_RULE')))

// Screens that draw their own lines: 1px, never 2px, and inner corners that fit an 8px frame.
const TWO_PX = /\b(border|divide)(-[xytrbl])?-2\b/
const OLD_CORNER = /rounded-t-\[2px\]/
const screenFiles = [
  ['components', 'entries', 'EntryParts.js'],
  ['components', 'entries', 'EntryListParts.js'],
  ['components', 'entries', 'DayEntries.js'],
  ['components', 'Modal.js'],
  ['components', 'StationWallet.js'],
  ['components', 'desktop', 'LicenceGate.js'],
  ['components', 'desktop', 'LinkForm.js'],
  ['components', 'desktop', 'PendingChanges.js'],
  ['components', 'desktop', 'RestoreBackup.js'],
  ['screens', 'dashboard', 'entries', 'lube', 'list', 'page.js'],
  ['screens', 'dashboard', 'entries', 'lube', 'page.js'],
  ['screens', 'dashboard', 'reports', 'account-ledger', 'page.js'],
  ['screens', 'dashboard', 'reports', 'analytics', 'page.js'],
  ['screens', 'dashboard', 'reports', 'lube-report', 'page.js'],
  ['components', 'Footer.js'],
  ['screens', 'dashboard', 'entries', 'daily-sales', 'page.js'],
  ['screens', 'dashboard', 'stations', '[stationId]', 'page.js'],
  ['app', 'auth', 'authStyles.js'],
  // Not the audit report: its 2px top bar marks the open tab, it is not an outline.
]
console.log('\nScreens with their own lines')
for (const p of screenFiles) {
  // A round loading spinner keeps its 2px ring: it is a spinner, not an outline.
  const src = read(...p).split('\n').filter((l) => !l.includes('animate-spin')).join('\n')
  check(`${p.slice(-2).join('/')}: no 2px lines`, !TWO_PX.test(src))
  check(`${p.slice(-2).join('/')}: no 2px inner corners`, !OLD_CORNER.test(src))
}
check('an entry card is filled', /<section [^>]*className=\{`bg-subtle border-card/.test(read('components', 'entries', 'EntryParts.js')))
const auth = read('app', 'auth', 'authStyles.js')
check('sign-in fields are filled boxes with 8px corners', (auth.match(/AUTH_INPUT(_PLAIN)? =\s*'[^']*\bborder\b[^']*rounded-house/g) || []).length === 2)
check('the sign-in button is solid blue with white text', /AUTH_SUBMIT =\s*'[^']*bg-primary-600[^']*text-white[^']*rounded-house/.test(auth))
check('a dialog has 8px corners',/className="relative bg-surface border-card[^"]*rounded-house/.test(read('components', 'Modal.js')))
const wallet = read('components', 'StationWallet.js')
check('the wallet card has 8px corners', /className="relative bg-primary-600 text-white[^"]*rounded-house/.test(wallet))
check('the wallet\'s buttons are solid on the blue', /const roundBtn = '[^']*bg-white text-primary-600/.test(wallet) && /const chip = '[^']*bg-white\/20/.test(wallet))
check('Link\'s download-backup button is a solid button', /onClick=\{downloadBackup\} className=\{`[^`]*\$\{BTN_FRAMED\}`\}/.test(read('components', 'desktop', 'LinkForm.js')))
check('the pending changes list and the restore warning box have 8px corners', /divide-line border border-line rounded-house/.test(read('components', 'desktop', 'PendingChanges.js')) && /bg-subtle border border-line rounded-house/.test(read('components', 'desktop', 'RestoreBackup.js')))
check('the day\'s entries panel is filled', /<section className="entries-list bg-subtle /.test(read('components', 'entries', 'DayEntries.js')))
check('a soft blue icon circle shows in dark mode too', /export const CHIP_MONO = '[^']*dark:bg-primary-500\/20/.test(read('components', 'ui', 'index.js')))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
