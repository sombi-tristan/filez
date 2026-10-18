import { REPORT_LINKS } from './stationNav'

/**
 * The reports a person opened most recently on this computer, per station, for the station
 * home's Reports panel (screens/dashboard/stations/[stationId]/page.js). Each report screen
 * notes itself as it opens (components/shell/Screen.js). Kept in the browser's storage: it is a
 * convenience for this viewer, so storage that is blocked or empty only means the fixed six.
 */
const KEY = (stationId) => `stationmgr:recent-reports:${stationId}`
const KEEP = 12 // more than shown, so a report later hidden or barred still leaves six

/** Until a person has opened six, the home tops up from these. */
export const FIXED_REPORTS = [
  'report-daily-sales', 'report-summary', 'report-audit', 'report-sales-overview', 'report-inventory-log', 'report-account-ledger',
]

function readKeys(stationId) {
  try {
    const list = JSON.parse(globalThis.localStorage?.getItem(KEY(stationId)) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** Notes a report (its pageKey) as opened just now. */
export function recordReport(stationId, pageKey) {
  if (!stationId || !pageKey) return
  try {
    const next = [pageKey, ...readKeys(stationId).filter((k) => k !== pageKey)].slice(0, KEEP)
    globalThis.localStorage?.setItem(KEY(stationId), JSON.stringify(next))
  } catch { /* storage blocked: the home shows the fixed six */ }
}

/** The same, from a report screen's path (/dashboard/reports/summary). */
export function recordReportPath(stationId, path) {
  const link = REPORT_LINKS(stationId).find((l) => l.href.split('?')[0] === path)
  if (link) recordReport(stationId, link.pageKey)
}

/**
 * The six for the home: the most recently opened first, then the fixed six, then the station's
 * other reports, each once. Only from `links` (the station's own reports, Rainoil-only ones
 * already left out) and only those `canAccess` allows.
 */
export function homeReports(links, stationId, canAccess = () => true, count = 6) {
  const byKey = new Map(links.map((l) => [l.pageKey, l]))
  const order = [...new Set([...readKeys(stationId), ...FIXED_REPORTS, ...links.map((l) => l.pageKey)])]
  return order.map((k) => byKey.get(k)).filter((l) => l && canAccess(l.pageKey)).slice(0, count)
}
