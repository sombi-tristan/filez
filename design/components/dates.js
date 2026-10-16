/**
 * Days, for DateInput: reading what somebody typed, and writing a day two ways. A day is kept
 * as `YYYY-MM-DD` and shown as `DD-MM-YYYY`. Everything here is local time; nothing goes through
 * `toISOString`, which is UTC and lands on the wrong day either side of midnight.
 */
const pad = (n) => String(n).padStart(2, '0')

/** A real calendar day, or null: 31-02 is nobody's day. */
function day(year, month, date) {
  const d = new Date(year, month - 1, date)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === date ? d : null
}

const fullYear = (y) => (y < 100 ? y + (y < 50 ? 2000 : 1900) : y)

/** `YYYY-MM-DD`, the stored form. */
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** `DD-MM-YYYY`, the form on screen. */
export const toDisplay = (d) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`

/** A stored day as a Date at local midnight, or null. */
export function fromIso(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  return m ? day(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/**
 * What somebody typed, as a day, or null. Day first, always. Understood:
 *   t, y                   today, yesterday
 *   15                     the 15th of this month
 *   15-3, 15/3, 15.3       this year
 *   15-3-26, 15/03/2026    two-digit years: under 50 is 20xx, the rest 19xx
 *   150326, 15032026       no separators
 */
export function parseDay(typed, today = new Date()) {
  const raw = String(typed || '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 't') return new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (raw === 'y') return addDays(today, -1)
  const text = raw.replace(/[^0-9/.\-\s]/g, '')
  if (!text) return null

  let m = /^(\d{1,2})$/.exec(text)
  if (m) return day(today.getFullYear(), today.getMonth() + 1, Number(m[1]))

  m = /^(\d{1,2})[/.\-\s](\d{1,2})$/.exec(text)
  if (m) return day(today.getFullYear(), Number(m[2]), Number(m[1]))

  m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/.exec(text)
  if (m) return day(fullYear(Number(m[3])), Number(m[2]), Number(m[1]))

  m = /^(\d{2})(\d{2})(\d{2}|\d{4})$/.exec(text)
  if (m) return day(fullYear(Number(m[3])), Number(m[2]), Number(m[1]))

  return null
}
