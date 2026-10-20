/**
 * Pins that a failure in the Android app shows on screen instead of freezing silently
 * (components/AppErrorBanner.js, loaded by components/AppShell.js): an uncaught error or a
 * rejected promise puts its own message across the top. And that Station Settings' Save shows
 * its error and comes back when the request itself fails, instead of staying disabled.
 *
 * Run: node tests/app-error-banner.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => (existsSync(new URL(path, import.meta.url)) ? readFileSync(new URL(path, import.meta.url), 'utf8') : '')
const banner = read('../components/AppErrorBanner.js')
const shell = read('../components/AppShell.js')
const settings = read('../screens/dashboard/stations/[stationId]/settings/page.js')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

console.log('Error banner')
check('there is one', banner.includes('export default function AppErrorBanner'))
check('it catches uncaught errors and rejected promises', banner.includes("addEventListener('error'") && banner.includes("addEventListener('unhandledrejection'"))
check('it shows the error\'s own message', /\.message/.test(banner) && banner.includes('role="alert"'))
check('only in the Android app', banner.includes('IS_APP'))
check('it can be closed', banner.includes('aria-label="Close"'))
check('AppShell loads it, even before the app is ready', shell.includes("import AppErrorBanner from '@/components/AppErrorBanner'") && /<AppErrorBanner \/>\s*\{ready \? children : null\}/.test(shell))

console.log('\nStation Settings: Save')
const save = settings.slice(settings.indexOf('const handleSave = async'), settings.indexOf('if (loading) {'))
check('a failed request is caught', /try \{[\s\S]*await fetch\('\/api\/onboarding'[\s\S]*\} catch \(err\) \{/.test(save))
check('and its message shown', /catch \(err\) \{\s*setError\(/.test(save) && save.includes('err.message'))
check('the button always comes back', /\} finally \{\s*setSaving\(false\)\s*submittingRef\.current = false\s*\}/.test(save))
check('an error reply that is not JSON still shows something', save.includes('res.json().catch('))

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
