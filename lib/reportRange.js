import { paidNow } from '@/lib/local/licence'

/**
 * Desktop build: how far back a report may reach. Reports are free for up to FREE_REPORT_DAYS
 * days (the start day and the end day both count); a longer range needs the station to have a
 * subscription running (lib/local/licence.js, any service).
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
