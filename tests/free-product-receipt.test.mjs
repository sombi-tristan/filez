/**
 * Pins that product receipt is free on the web: the API does not ask for the Fuel operations
 * subscription before saving, editing or deleting, and the form and list do not grey out Save
 * or New behind one.
 *
 * Run: node tests/free-product-receipt.test.mjs
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

check('the API does not ask for a subscription', !read('app', 'api', 'entries', 'product-receipt', 'route.js').includes('requireService('))
check('the form does not gate on a subscription', !read('screens', 'dashboard', 'entries', 'product-receipt', 'page.js').includes('useSubscription('))
check('a desktop push of receipts needs no service', !/product_receipt_entries: {[^}]*service:/.test(read('lib', 'desktopTables.js')))
check('the list does not gate on a subscription', !read('screens', 'dashboard', 'entries', 'product-receipt', 'list', 'page.js').includes('useSubscription('))

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
