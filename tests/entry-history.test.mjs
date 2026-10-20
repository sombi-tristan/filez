/**
 * Pins who added and who last edited each entry, shown under it in the day's form
 * (components/EntryHistory.js), now that the Notifications screen is gone. The names come with
 * the rows on every path that stores them on the phone: the list (GET), a save's own reply
 * (POST, PATCH) and the poll for others' changes, so a save or a poll never drops them.
 *
 * Run: node tests/entry-history.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => (existsSync(new URL(path, import.meta.url)) ? readFileSync(new URL(path, import.meta.url), 'utf8') : '')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const WHO = "users:created_by(name), editor:updated_by(name)"

console.log('On the phone')
const sync = read('../lib/sync.js')
const base = sync.slice(sync.indexOf('export function normalizeEntry'), sync.indexOf('switch (table)', sync.indexOf('export function normalizeEntry')))
check('an entry keeps who added it, by name', base.includes('createdByName: serverRecord.users?.name || null'))
check('and who last changed it', base.includes('updatedBy: serverRecord.updated_by || null') && base.includes('updatedByName: serverRecord.editor?.name || null'))

console.log('\nThe line under an entry')
const line = read('../components/EntryHistory.js')
check('there is one', line.includes('export default function EntryHistory({ entry })'))
check('who added it, and when', line.includes('Added by ${entry.createdByName}') && line.includes('when(entry.createdAt)'))
check('an edit only when it changed after it was added', line.includes('EDITED_AFTER') && line.includes('Edited ${when(entry.updatedAt)}'))
check('the editor by name when known', line.includes(' by ${entry.updatedByName}'))
check('an entry not yet on the server says so', line.includes('Not on the server yet'))

console.log('\nUnder each entry in the day\'s form')
const day = read('../components/entries/DayEntries.js')
check('the day\'s list shows it under each entry', day.includes("import EntryHistory from '@/components/EntryHistory'") && day.includes('{item.entry ? <EntryHistory entry={item.entry} /> : null}'))
for (const form of ['daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments']) {
  const src = read(`../screens/dashboard/entries/${form}/page.js`)
  const lists = src.split('const listItems = ').slice(1).map((s) => s.slice(0, s.indexOf('\n  const ') > 0 ? s.indexOf('\n  const ') : 600))
  const carries = form === 'product-receipt'
    ? lists.every((l) => l.includes('entry: combineHistory((dayRecords || []).filter((x) => r.ids.includes(x.id)))'))
    : lists.every((l) => /entry: e[,\s]/.test(l))
  check(`${form}: each item carries its entry`, lists.length > 0 && carries)
}

console.log('\nThe names come with every row')
const poll = read('../app/api/entries/poll/route.js')
check('the poll for others\' changes', poll.includes(`.select('*, ${WHO}')`))
for (const name of ['daily-sales', 'product-receipt', 'lodgements', 'lube-sales', 'lube-stock', 'customer-payments']) {
  const src = read(`../app/api/entries/${name}/route.js`)
  const lists = (src.match(new RegExp(`select\\('\\*, ${WHO.replace(/[()]/g, '\\$&')}`, 'g')) || []).length
  check(`${name}: the list and a save's reply`, lists === 4 && !src.includes('.select()'))
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
