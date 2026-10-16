/**
 * Pins the desktop app's free entries: daily sales, lodgements and product receipt open, save,
 * edit and delete with no subscription. The screen is not locked (screens/routes.js has no
 * `service` for it), the in-app server does not ask for one (lib/local/routes/entries), and the
 * screen itself does not grey out Save behind a subscription check.
 *
 * Run: node tests/desktop-free-entries.test.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const read = (...p) => readFileSync(resolve(root, ...p), 'utf8')

let failures = 0
function check(name, ok) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`)
  if (!ok) failures++
}

const routes = read('screens', 'routes.js')
const FREE = ['daily-sales', 'lodgements', 'product-receipt']

for (const entry of FREE) {
  console.log(entry)
  for (const path of [`/dashboard/entries/${entry}'`, `/dashboard/entries/${entry}/list'`]) {
    const row = routes.split('\n').find((l) => l.includes(`path: '${path}`))
    check(`${path.slice(0, -1)} is not locked`, Boolean(row) && !row.includes('service:'))
  }
  check('the in-app server does not ask for a subscription', !read('lib', 'local', 'routes', 'entries', entry, 'route.js').includes('requireService('))
  for (const screen of [['page.js'], ['list', 'page.js']]) {
    const src = read('screens', 'dashboard', 'entries', entry, ...screen)
    check(`${screen.join('/')} does not gate on a subscription`, !src.includes('useSubscription('))
  }
}

console.log('\nPush')
check('product receipts push with no service', !/product_receipt_entries: \{[^}]*service:/.test(read('lib', 'desktopTables.js')))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
