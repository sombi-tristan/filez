/**
 * Pins the station home's Reports, as the owner asked for it:
 *
 *   A full-width Reports panel like the Entries one: the reports this person opened most
 *   recently on this device (lib/recentReports.js, recorded by each report screen as it opens),
 *   topped up from a fixed six and then the station's other reports, only ones they may open.
 *   The website keeps four reports, so all of them show: no "View all" and no Reports screen.
 *   Staff sits in its own full-width panel under Reports.
 *
 * Run: node tests/station-home-reports.test.mjs
 */
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('./helpers/app-loader.mjs', import.meta.url)

// The browser's storage, as a map: what lib/recentReports.js keeps per station.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
}
const recent = await import('../lib/recentReports.js')
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const links = [
  'report-summary', 'report-daily-sales', 'report-sales-overview', 'report-inventory-log', 'report-analytics',
  'report-audit', 'report-account-ledger', 'report-product-received', 'report-lube', 'imprest',
].map((pageKey) => ({ pageKey, href: `/dashboard/reports/${pageKey}?org_id=s1` }))
const keys = (list) => list.map((l) => l.pageKey)

console.log('Recently opened, per station')
check('nothing opened yet: the fixed six', keys(recent.homeReports(links, 's1')).join() === recent.FIXED_REPORTS.join())
recent.recordReport('s1', 'report-lube')
recent.recordReport('s1', 'report-audit')
recent.recordReport('s1', 'report-lube')
check('the most recent first, each once, topped up from the fixed six', keys(recent.homeReports(links, 's1')).join() === ['report-lube', 'report-audit', ...recent.FIXED_REPORTS.filter((k) => k !== 'report-audit')].slice(0, 6).join())
check('another station keeps its own', keys(recent.homeReports(links, 's2')).join() === recent.FIXED_REPORTS.join())
for (const k of ['imprest', 'report-summary', 'report-analytics', 'report-product-received', 'report-daily-sales', 'report-inventory-log']) recent.recordReport('s1', k)
check('topped up from the station\'s other reports when the fixed six are not all there', (() => {
  const few = links.filter((l) => ['report-summary', 'report-analytics', 'report-inventory-log', 'report-account-ledger'].includes(l.pageKey))
  return keys(recent.homeReports(few, 's9')).sort().join() === keys(few).sort().join()
})())
check('six at most, the oldest dropped',keys(recent.homeReports(links, 's1')).join() === ['report-inventory-log', 'report-daily-sales', 'report-product-received', 'report-analytics', 'report-summary', 'imprest'].join())
check('only reports this person may open', !keys(recent.homeReports(links, 's1', (k) => k !== 'imprest')).includes('imprest') && recent.homeReports(links, 's1', (k) => k !== 'imprest').length === 6)
check('only reports this station lists (a Rainoil-only one elsewhere is left out)', (() => { recent.recordReport('s3', 'report-sales-operation'); return !keys(recent.homeReports(links, 's3')).includes('report-sales-operation') })())
check('storage that throws is not fatal', (() => { const g = globalThis.localStorage; globalThis.localStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }; try { recent.recordReport('s1', 'report-lube'); return recent.homeReports(links, 's1').length === 6 } finally { globalThis.localStorage = g } })())

console.log('\nEach report screen notes itself')
const shell = read('components/shell/Screen.js')
check('Screen records a report as it opens', shell.includes("import { recordReportPath } from '@/lib/recentReports'") && /if \(screen\.report && stationId\) recordReportPath\(stationId, screen\.path\)/.test(shell))

console.log('\nStation home')
const home = read('screens/dashboard/stations/[stationId]/page.js')
const panel = home.slice(home.indexOf('{/* Reports: the ones'), home.indexOf('{/* Manage Station'))
check('a full-width Reports panel like the Entries one', /<section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">/.test(panel))
check('report widgets two a row, each half the panel wide, 112px tall', panel.includes('<div className="grid grid-cols-2 gap-3">') && /function Widget[\s\S]*?className="w-full h-28 flex flex-col/.test(home) && /function Widget[\s\S]*?className="w-10 h-10"/.test(home))
check('six widgets, recently opened first', panel.includes('homeReports(reportLinks, stationId, canAccess)') && panel.includes('<Widget'))
check('under Reports', panel.indexOf('{staffSection}') > panel.indexOf('homeReports('))
check('the grouped rows are gone from home', !home.includes('REPORT_COLUMNS.map'))
check('Staff is a full-width panel of its own', /const staffSection = isOwner \? \(\s*<section className="mt-6 w-full bg-surface border-card border-line rounded-house p-3">\s*<h2[^>]*>Staff<\/h2>/.test(home) && !/const staffSection[\s\S]{0,400}\$\{CARD\}/.test(home))

console.log(`\n${failures === 0 ? 'All passed' : `${failures} failed`}`)
process.exit(failures === 0 ? 0 : 1)
