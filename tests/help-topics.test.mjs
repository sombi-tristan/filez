/**
 * The Help page's walkthroughs (lib/helpTopics.js): one per demo video, each with a title,
 * subtitle, the video's step guide and a detailed explanation in the blocks the Help page draws.
 * Where the video project sits beside this one (../stationmgr-videos), the steps must match its
 * step guide word for word, so the help and the video never tell two different stories.
 *
 * Run: node tests/help-topics.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { HELP_TOPICS } from '../lib/helpTopics.js'

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const IDS = ['home', 'daily-sales', 'lodgements', 'summary', 'consumption-fuel-stock', 'lube', 'account-ledger']
const SHAPES = ['p', 'h', 'list', 'steps', 'defs', 'note']

console.log('One walkthrough per demo video')
check(`the seven demos, in order (${IDS.join(', ')})`, JSON.stringify(HELP_TOPICS.map((t) => t.id)) === JSON.stringify(IDS))

console.log('Each walkthrough is complete')
for (const t of HELP_TOPICS) {
  const shapeOk = t.blocks.every((b) => {
    const keys = Object.keys(b)
    if (keys.length !== 1 || !SHAPES.includes(keys[0])) return false
    const v = b[keys[0]]
    if (typeof v === 'string') return v.trim().length > 0
    return Array.isArray(v) && v.length > 0 && v.every((x) => (Array.isArray(x) ? x.length === 2 && x.every((s) => s.trim()) : x.trim()))
  })
  check(`${t.id}: title, subtitle and steps`, !!t.title?.trim() && !!t.subtitle?.trim() && t.steps?.length >= 3 && t.steps.every((s) => s.trim()))
  check(`${t.id}: every block is one the Help page draws`, shapeOk)
  check(`${t.id}: detailed, with sub-headings`, t.blocks.length >= 8 && t.blocks.filter((b) => b.h).length >= 3)
}

console.log('Names as the app shows them')
const text = JSON.stringify(HELP_TOPICS)
check('the Accounts entry screen is not called "Account Payment" (its tile says Accounts)', !text.includes('Account Payment'))

console.log('Each walkthrough has its video, kept out of the PWA precache')
for (const t of HELP_TOPICS) {
  check(`${t.id}: public/help/videos/${t.id}.mp4 and its poster .jpg`,
    existsSync(new URL(`../public/help/videos/${t.id}.mp4`, import.meta.url)) && existsSync(new URL(`../public/help/videos/${t.id}.jpg`, import.meta.url)))
}
// Everything in public/ is precached by default, which would download every video on install.
const config = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8')
check('next.config.mjs leaves help/videos out of the precache', config.includes("'!help/videos/**/*'"))
check('next.config.mjs never caches the videos at run time either', /help\\\/videos[^\n]*\n\s*handler: 'NetworkOnly'/.test(config))

// lib/helpContent.js carries lucide icons, so it is read as text rather than imported.
console.log('The Backups guide, on the website only')
const content = readFileSync(new URL('../lib/helpContent.js', import.meta.url), 'utf8')
const backups = content.slice(content.indexOf("id: 'backups'"), content.indexOf("id: 'staff'"))
check('lib/helpContent.js has a Backups guide', content.includes("id: 'backups'") && backups.includes("title: 'Backups'"))
check('it is marked web-only', backups.includes('webOnly: true'))
check('it names the buttons as the apps show them (This computer, Back up data, Restore from backup, Linked computers)',
  ['This computer', 'Back up data', 'Restore from backup', 'Linked computers'].every((s) => backups.includes(s)))
check('it says to back up every day', /every day/i.test(backups))
const page = readFileSync(new URL('../screens/dashboard/feedback/page.js', import.meta.url), 'utf8')
check('the Help page leaves web-only guides out of the Android app (IS_APP)', /IS_APP && s\.webOnly/.test(page))

const demos = new URL('../../stationmgr-videos/src/demos.js', import.meta.url)
if (existsSync(demos)) {
  console.log('Steps match the videos')
  const { DEMOS } = await import(demos.href)
  for (const t of HELP_TOPICS) {
    const d = DEMOS.find((x) => x.id === t.id)
    check(`${t.id}: the video's step guide, word for word`, !!d && JSON.stringify(d.steps) === JSON.stringify(t.steps))
  }
} else {
  console.log('  (skipped: ../stationmgr-videos is not beside this project)')
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
