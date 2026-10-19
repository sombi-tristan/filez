/**
 * Pins blue icons to Premeval's blue (#0093DD, --primary-500) in light mode (app/globals.css):
 * an icon coloured primary-600/700/800, itself or by the blue text it sits in, takes the 500.
 * Only icons: the text keeps its shade. Dark mode keeps its light blues.
 *
 * Run: node tests/icon-blue.test.mjs
 */
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\r/g, '')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const rule = css.slice(css.indexOf('/* Premeval blue icons'))
console.log('Blue icons')
check('Premeval blue is the 500', /--primary-500:\s*0 147 221;/.test(css))
check('an icon coloured a darker blue takes the 500', rule.includes(":root:not([data-theme='dark']) .lucide:is(.text-primary-600, .text-primary-700, .text-primary-800)"))
check('so does an icon in darker blue text, when it has no colour of its own', rule.includes(":root:not([data-theme='dark']) :is(.text-primary-600, .text-primary-700, .text-primary-800) .lucide:not([class*=\"text-\"])"))
check('only the icon changes', /\{\s*color: rgb\(var\(--primary-500\)\);\s*\}/.test(rule) && !/\.text-primary-600\s*\{/.test(rule))
check('dark mode is left alone', !rule.includes("[data-theme='dark'] .lucide"))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
