/**
 * Pins how pasted POS lines become lodgement entries.
 *
 * Bedbug reads the banks' end-of-day POS slips and copies one line per amount:
 *   2026-10-25<TAB>POS<TAB>2039DDE3<TAB>471980.00
 * Each line finds its account by the terminal ID and the type (a Squad terminal has a POS account
 * and a transfer account under the same ID). The date is the sales date. A phone reading a
 * thermal print can take 0 for O or 1 for I, so those count as the same in a terminal ID.
 *
 * Run: node tests/pos-paste.test.mjs
 */
import { readPosLines } from '../lib/posPaste.js'

let failures = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
  if (!ok) failures++
}

const banks = [
  { id: 'b1', bank_name: 'Stanbic IBTC', lodgement_type: 'pos', terminal_id: '2039DDE3' },
  { id: 'b2', bank_name: 'Stanbic IBTC', lodgement_type: 'pos', terminal_id: '2039FXRI' },
  { id: 'b3', bank_name: 'Squad', lodgement_type: 'pos', terminal_id: '2058A5WH' },
  { id: 'b4', bank_name: 'Squad', lodgement_type: 'transfer', terminal_id: '2058a5wh' },
  { id: 'b5', bank_name: 'Zenith', lodgement_type: 'deposit', terminal_id: '' },
]

console.log('readPosLines')
{
  const r = readPosLines('2026-10-25\tPOS\t2039DDE3\t471980.00\n2026-10-25\tPOS\t2058A5WH\t156760.00\n2026-10-25\tTRANSFER\t2058A5WH\t334360.00\n', banks)
  check('one entry per line, its account by terminal and type', r.entries, [
    { bankId: 'b1', lodgementType: 'pos', amount: '471980.00', salesDate: '2026-10-25' },
    { bankId: 'b3', lodgementType: 'pos', amount: '156760.00', salesDate: '2026-10-25' },
    { bankId: 'b4', lodgementType: 'transfer', amount: '334360.00', salesDate: '2026-10-25' },
  ])
  check('nothing left over', r.problems, [])
}
check('spaces instead of tabs, and commas in the amount', readPosLines('2026-10-25  POS 2039DDE3  471,980.00', banks).entries.map((e) => [e.bankId, e.amount]), [['b1', '471980.00']])
check('0 for O and 1 for I in a terminal ID still match', readPosLines('2026-10-25\tPOS\t2039FXR1\t698193.00', banks).entries.map((e) => e.bankId), ['b2'])
check('lower-case type and terminal', readPosLines('2026-10-25 pos 2039dde3 10', banks).entries.map((e) => e.bankId), ['b1'])
{
  const r = readPosLines('2026-10-25\tPOS\t9999XXXX\t500.00\n2026-10-25\tTRANSFER\t2039DDE3\t20.00\nhello there\n\n', banks)
  check('a line with no account is left over, saying why', r.problems, [
    { line: '2026-10-25\tPOS\t9999XXXX\t500.00', reason: 'No POS account with terminal 9999XXXX' },
    { line: '2026-10-25\tTRANSFER\t2039DDE3\t20.00', reason: 'No transfer account with terminal 2039DDE3' },
    { line: 'hello there', reason: 'Not a POS line (date, POS or TRANSFER, terminal, amount)' },
  ])
  check('...and adds no entry', r.entries, [])
}
{
  const twice = [...banks, { id: 'b6', bank_name: 'Other', lodgement_type: 'pos', terminal_id: '2039DDE3' }]
  check('two accounts with the same terminal and type: left over', readPosLines('2026-10-25 POS 2039DDE3 5', twice).problems.map((p) => p.reason), ['2 POS accounts have terminal 2039DDE3; pick the account by hand'])
}
check('a date that is not a real day is left over', readPosLines('2026-02-30 POS 2039DDE3 5', banks).problems.map((p) => p.reason), ['Not a POS line (date, POS or TRANSFER, terminal, amount)'])
check('empty paste: nothing', readPosLines('  \n ', banks), { entries: [], problems: [] })

if (failures) { console.log(`\n${failures} failed`); process.exit(1) }
console.log('\nall passed')
