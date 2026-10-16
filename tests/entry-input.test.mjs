/**
 * Pins the two plain rules the entry screens run on.
 *
 * adjacentDates decides where the day bar's arrows go. It has to work from any date, not
 * only one that is saved: a new day typed into the field still needs a way back to the last
 * saved one.
 *
 * cleanNumber is what a number field keeps. The fields are text inputs with a number pad
 * (inputMode="decimal"), so anything pasted reaches them; what they keep has to survive
 * Number() when the entry is saved, or a pasted "1,250" is stored as 0.
 *
 * Run: node tests/entry-input.test.mjs
 */
import { adjacentDates, cleanNumber } from '../lib/entryInput.js'

let failures = 0
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`)
  if (!ok) failures++
}

const days = ['2026-10-01', '2026-10-03', '2026-10-07']

console.log('adjacentDates')
check('a saved day in the middle', adjacentDates(days, '2026-10-03'), { prev: '2026-10-01', next: '2026-10-07' })
check('the first saved day has no day before', adjacentDates(days, '2026-10-01'), { prev: null, next: '2026-10-03' })
check('the last saved day has no day after', adjacentDates(days, '2026-10-07'), { prev: '2026-10-03', next: null })
check('an unsaved day between two saved ones', adjacentDates(days, '2026-10-05'), { prev: '2026-10-03', next: '2026-10-07' })
check('today, after every saved day', adjacentDates(days, '2026-10-16'), { prev: '2026-10-07', next: null })
check('nothing saved yet', adjacentDates([], '2026-10-16'), { prev: null, next: null })

console.log('\ncleanNumber')
check('a plain number', cleanNumber('1250.5'), '1250.5')
check('thousands commas', cleanNumber('1,250'), '1250')
check('a currency sign and spaces', cleanNumber('₦ 2 000'), '2000')
check('a second point', cleanNumber('12.5.3'), '12.53')
check('a minus sign', cleanNumber('-40'), '40')
check('empty', cleanNumber(''), '')
check('undefined', cleanNumber(undefined), '')

console.log(failures === 0 ? '\nAll passed' : `\n${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
