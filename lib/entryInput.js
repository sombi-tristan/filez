/**
 * The plain rules behind the entry screens (components/entries/EntryParts.js), kept apart
 * from the components so they can be tested without a browser.
 */

/** The saved days on either side of `date` among `dates` (sorted YYYY-MM-DD strings). */
export function adjacentDates(dates, date) {
  let prev = null
  let next = null
  for (const d of dates) {
    if (d < date) prev = d
    else if (d > date && next === null) next = d
  }
  return { prev, next }
}

/**
 * What a number field keeps of what was typed or pasted: digits and the first point. Commas
 * ("1,250"), spaces, currency signs and a second point are dropped rather than turning the
 * whole value into 0 when it is saved with Number().
 */
export function cleanNumber(raw) {
  return String(raw ?? '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
}
