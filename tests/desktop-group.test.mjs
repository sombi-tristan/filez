/**
 * Pins that a desktop pull carries the station's group name (lib/desktopGroup.js, used by
 * app/api/desktop/pull): the desktop chooses the Rainoil workbooks by that name
 * (lib/exportGroup.js), and the groups themselves do not sync to it.
 *
 * Run: node tests/desktop-group.test.mjs
 */
import { resolve, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { groupNameOf } = await import(pathToFileURL(resolve(__dirname, '..', 'lib', 'desktopGroup.js')).href)

let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}
const db = (tables) => ({
  from(table) {
    const f = []
    const api = { select() { return api }, eq(c, v) { f.push([c, v]); return api }, async maybeSingle() { return { data: (tables[table] || []).find((r) => f.every(([c, v]) => r[c] === v)) || null } } }
    return api
  },
})
const tables = {
  organizations: [{ id: 'kubwa', station_group_id: 'g1' }, { id: 'wuse', station_group_id: null }],
  station_groups: [{ id: 'g1', name: 'RAINOIL' }],
}
check('a station in a group: its name', (await groupNameOf(db(tables), 'kubwa')) === 'RAINOIL')
check('a station in none: empty', (await groupNameOf(db(tables), 'wuse')) === '')
check('a station not found: empty', (await groupNameOf(db(tables), 'nowhere')) === '')

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
