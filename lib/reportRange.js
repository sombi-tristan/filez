import { paidNow } from '@/lib/local/licence'

/**
 * Desktop build: how much a report may cover. Reports are free for any FREE_REPORT_DAYS days in
 * a row, anywhere in the station's history (the start day and the end day both count); a longer
 * range needs the station to have a subscription running (lib/local/licence.js, any service).
 */
export const FREE_REPORT_DAYS = 5

const DAY = 24 * 60 * 60 * 1000
const toDate = (iso) => new Date(`${iso}T00:00:00`)
const toIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The number of days from start to end, both counted. */
export function rangeDays(start, end) {
  if (!start || !end) return 0
  return Math.round((toDate(end) - toDate(start)) / DAY) + 1
}

/** The day `days` after (or before, when negative) a YYYY-MM-DD day. */
export function shiftDay(iso, days) {
  const d = toDate(iso)
  d.setDate(d.getDate() + days)
  return toIso(d)
}

/**
 * The range after one of its dates is moved. Without a subscription the other date follows, so
 * the range stays within the free days wherever it is moved to: a new start takes the end along
 * to at most FREE_REPORT_DAYS days later, a new end takes the start along to at most that many
 * days earlier. With one, the dates move freely.
 */
export function moveRange({ start, end }, which, day) {
  const next = which === 'start' ? { start: day, end } : { start, end: day }
  if (paidNow() || !next.start || !next.end) return next
  const span = FREE_REPORT_DAYS - 1
  if (which === 'start' && (next.end < next.start || rangeDays(next.start, next.end) > FREE_REPORT_DAYS)) next.end = shiftDay(next.start, span)
  if (which === 'end' && (next.start > next.end || rangeDays(next.start, next.end) > FREE_REPORT_DAYS)) next.start = shiftDay(next.end, -span)
  return next
}

/** Whether a report may run over start..end on this computer now. */
export function rangeAllowed(start, end) {
  return paidNow() || rangeDays(start, end) <= FREE_REPORT_DAYS
}

/**
 * Where a report's range starts when it opens: the month's first day with a subscription,
 * otherwise as far back as the free range reaches from today.
 */
export function defaultReportStart(todayStr, monthStartStr) {
  if (paidNow()) return monthStartStr
  const start = toDate(todayStr)
  start.setDate(start.getDate() - (FREE_REPORT_DAYS - 1))
  const free = toIso(start)
  return free > monthStartStr ? free : monthStartStr
}
