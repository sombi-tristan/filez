/**
 * Pins how the reports list lodgements, and the summary's balances.
 *
 * Every lodgement account is listed, the ones with nothing lodged that day too (as 0), always
 * in alphabetical order: bank name, then terminal ID, then type. The daily sales report, its
 * Excel export and the summary list them the same way. The summary also shows the credit
 * customers' balances, as the daily sales report does.
 *
 * Run: node tests/report-lodgements.test.mjs
 */
import { readFileSync } from 'node:fs'
import { calculateDateRangeLodgements, sortBanks } from '../lib/lodgementCalculations.js'

let failures = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
  if (!ok) failures++
}
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const banks = [
  { id: 'zt', bank_name: 'Zenith', lodgement_type: 'transfer', terminal_id: '' },
  { id: 'sq-t', bank_name: 'Squad', lodgement_type: 'transfer', terminal_id: '2058A5WH' },
  { id: 'st2', bank_name: 'Stanbic IBTC', lodgement_type: 'pos', terminal_id: '2039DDE3' },
  { id: 'acc', bank_name: 'Access', lodgement_type: 'bank_deposit', terminal_id: '' },
  { id: 'sq-p', bank_name: 'Squad', lodgement_type: 'pos', terminal_id: '2058A5WH' },
  { id: 'st1', bank_name: 'Stanbic IBTC', lodgement_type: 'pos', terminal_id: '2039DDE2' },
]

console.log('alphabetical, always')
check('by bank name, then terminal ID, then type', sortBanks(banks).map((b) => b.id), ['acc', 'sq-p', 'sq-t', 'st1', 'st2', 'zt'])
{
  const lodgements = [{ id: 'l1', bankId: 'st2', amount: 471980, salesDate: '2026-10-25', createdAt: '1' }]
  const day = calculateDateRangeLodgements(lodgements, banks, '2026-10-25', '2026-10-25').dates[0]
  check('a day lists every account in that order, nothing lodged as 0', day.bankRows.map((r) => [r.bankId, r.deposited]), [['acc', 0], ['sq-p', 0], ['sq-t', 0], ['st1', 0], ['st2', 471980], ['zt', 0]])
}

console.log('the reports list every account')
for (const f of ['screens/dashboard/reports/daily-sales-report/page.js', 'screens/dashboard/reports/summary/page.js', 'lib/exportDailyReportExcel.js']) {
  const src = read(f)
  const lodgementList = src.includes('function exportDailyReport') || f.endsWith('.js') && f.startsWith('lib/')
    ? src.slice(src.indexOf("'Account', 'subhdr'"), src.indexOf("'Account', 'subhdr'") + 1200)
    : src.slice(src.indexOf('lodgement.bankRows'), src.indexOf('lodgement.bankRows') + 200)
  check(`${f}: no account left out for lodging nothing`, /bankRows\.filter\(r => r\.deposited > 0\)/.test(lodgementList), false)
}

console.log('summary: credit balances')
{
  const src = read('screens/dashboard/reports/summary/page.js')
  check('builds with the customers and their payments', /customers: liveCustomers \|\| \[\],\n\s*customerPayments: livePayments \|\| \[\],/.test(src), true)
  check('lube on account counts, as in the daily sales report', /lubeOnAccount\(/.test(src), true)
  check('shows the Balances card, opening the sheet', /onClick=\{\(\) => setBalancesOpen\(true\)\}/.test(src) && /<BalancesSheet /.test(src), true)
}

if (failures) { console.log(`\n${failures} failed`); process.exit(1) }
console.log('\nall passed')
