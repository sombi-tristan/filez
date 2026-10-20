/**
 * Pins who last changed an entry (migration 058): every entry table has updated_by beside
 * created_by, and every edit and every delete (a soft delete, deleted_at) through
 * app/api/entries/* sets it to the person signed in. The entry lists show it under each entry,
 * now that the Notifications screen is gone.
 *
 * Run: node tests/entry-updated-by.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => (existsSync(new URL(path, import.meta.url)) ? readFileSync(new URL(path, import.meta.url), 'utf8') : '')
const migration = read('../supabase/migrations/058_entry_updated_by.sql')
const bundle = read('../supabase/deploy/02_schema.sql')
let failures = 0
const check = (label, ok) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failures++
}

const TABLES = ['daily_sales_entries', 'product_receipt_entries', 'lodgement_entries', 'lube_sales_entries', 'lube_stock_entries', 'customer_payment_entries', 'imprest_entries']

console.log('Migration 058')
for (const t of TABLES) {
  check(`${t} gets updated_by`, new RegExp(`ALTER TABLE ${t}\\s+ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users\\(id\\) ON DELETE SET NULL;`).test(migration))
}
check('the bundle carries it', bundle.includes('058: Who last changed an entry'))

const ROUTES = {
  'daily-sales': '../app/api/entries/daily-sales/route.js',
  'product-receipt': '../app/api/entries/product-receipt/route.js',
  lodgements: '../app/api/entries/lodgements/route.js',
  'lube-sales': '../app/api/entries/lube-sales/route.js',
  'lube-stock': '../app/api/entries/lube-stock/route.js',
  'customer-payments': '../app/api/entries/customer-payments/route.js',
  imprest: '../app/api/entries/imprest/entries/[id]/route.js',
}

console.log('\nThe routes set it')
for (const [name, path] of Object.entries(ROUTES)) {
  const src = read(path)
  check(`${name}: an edit`, src.includes('const updates = { updated_at: new Date().toISOString(), updated_by: user.id }'))
  check(`${name}: a delete`, src.includes('.update({ deleted_at: now, updated_at: now, updated_by: user.id })') && !src.includes('.update({ deleted_at: now, updated_at: now })'))
}

console.log(failures ? `\n${failures} failed` : '\nAll passed')
process.exit(failures ? 1 : 0)
