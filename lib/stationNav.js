import {
  FileSpreadsheet, ClipboardList, CreditCard, Droplets, Users,
  FileText, BarChart3, Activity, TrendingUp, Boxes, LineChart,
  BookOpen, Truck, Wallet, Fuel,
} from 'lucide-react'
import { WEB_REPORT_KEYS } from '@/lib/platform'

/**
 * The station's destinations, in one place.
 *
 * These lists used to live inside screens/dashboard/stations/[stationId]/page.js, which was
 * fine while the hub was the only thing that navigated. A sidebar is a second consumer, and
 * two hand-maintained copies of "where can you go" drift the first time either is edited —
 * so the hub and the sidebar now read the same arrays.
 *
 * `pageKey` is the permission key checked against a member's visible_pages. An owner sees
 * everything; a restricted member sees only the keys they hold.
 *
 * ── A known gap, deliberately preserved here rather than quietly fixed ──────────────────
 * ENTRY_PERMISSION_OPTIONS / REPORT_PERMISSION_OPTIONS are what the permissions UI offers,
 * and they do NOT cover every destination: report-sales-overview, report-inventory-log and
 * report-analytics have no toggle. Because access is `isOwner || visiblePages.includes(key)`
 * and those keys can never be granted, restricted staff can never open those three reports.
 * That is a real bug, but fixing it widens what staff can see on a live system, so it is
 * surfaced here (see MISSING_PERMISSION_KEYS) rather than changed as a side effect of
 * moving code. store-portal hit exactly this with its `expenses` key.
 */

/**
 * Entry screens. `href` is built per station because every destination carries ?org_id=. Each
 * opens the entry form, on today; the form's Entries button opens the list.
 */
export const ENTRY_LINKS = (stationId) => [
  { href: `/dashboard/entries/daily-sales?org_id=${stationId}`, icon: FileSpreadsheet, label: 'Daily Sales', desc: 'Nozzle readings, stock, pricing', pageKey: 'daily-sales' },
  { href: `/dashboard/entries/product-receipt?org_id=${stationId}`, icon: ClipboardList, label: 'Product Receipt', desc: 'Deliveries and waybills', pageKey: 'product-receipt' },
  { href: `/dashboard/entries/lodgements?org_id=${stationId}`, icon: CreditCard, label: 'Lodgements', desc: 'Deposits and POS', pageKey: 'lodgements' },
  { href: `/dashboard/entries/lube?org_id=${stationId}`, icon: Droplets, label: 'Lube', desc: 'Lube sales and stock', pageKey: 'lube' },
  { href: `/dashboard/entries/customer-payments?org_id=${stationId}`, icon: Users, label: 'Accounts', desc: 'Credit sales and payments', pageKey: 'customer-payments' },
]

/**
 * Every report screen, including the ones only the desktop app keeps (lib/platform.js).
 * REPORT_LINKS is what the web offers.
 */
export const ALL_REPORT_LINKS = (stationId) => [
  { href: `/dashboard/reports/summary?org_id=${stationId}`, icon: FileText, label: 'Summary', desc: 'Overview summary report', pageKey: 'report-summary' },
  { href: `/dashboard/reports/daily-sales-report?org_id=${stationId}`, icon: BarChart3, label: 'Daily Sales Report', desc: 'Nozzle sales, POS, and cash', pageKey: 'report-daily-sales' },
  { href: `/dashboard/reports/sales-operation?org_id=${stationId}`, icon: Activity, label: 'Sales Operation', desc: 'Daily sales, stock, recon — per shift', pageKey: 'report-sales-operation' },
  { href: `/dashboard/reports/consumption-fuel-stock?org_id=${stationId}`, icon: Fuel, label: 'Consumption & Fuel Stock', desc: 'Daily consumption, pour back and tank stock', pageKey: 'report-audit-consumption' },
  { href: `/dashboard/reports/sales-overview?org_id=${stationId}`, icon: TrendingUp, label: 'Sales Overview', desc: 'Daily volume, price, and amount per fuel', pageKey: 'report-sales-overview' },
  { href: `/dashboard/reports/inventory-log?org_id=${stationId}`, icon: Boxes, label: 'Inventory Log', desc: 'Daily stock, supply, OV/SH, and variance', pageKey: 'report-inventory-log' },
  { href: `/dashboard/reports/analytics?org_id=${stationId}`, icon: LineChart, label: 'Analytics', desc: 'KPIs, stock, variance, and revenue trends', pageKey: 'report-analytics' },
  { href: `/dashboard/reports/audit-report?org_id=${stationId}`, icon: ClipboardList, label: 'Audit Report', desc: 'Station audit trail', pageKey: 'report-audit' },
  { href: `/dashboard/reports/account-ledger?org_id=${stationId}`, icon: BookOpen, label: 'Account Ledger', desc: 'Credit accounts and balances', pageKey: 'report-account-ledger' },
  { href: `/dashboard/reports/product-received?org_id=${stationId}`, icon: Truck, label: 'Product Received', desc: 'Deliveries, waybills, shortages', pageKey: 'report-product-received' },
  { href: `/dashboard/reports/lube-report?org_id=${stationId}`, icon: Droplets, label: 'Lube Report', desc: 'Lube sales, stock, and lodgements', pageKey: 'report-lube' },
  { href: `/dashboard/reports/imprest?org_id=${stationId}`, icon: Wallet, label: 'Imprest', desc: 'Petty cash entries and reports', pageKey: 'imprest' },
]

/** The reports the web offers: Summary, Analytics, Inventory Log and Account Ledger. */
export const REPORT_LINKS = (stationId) => ALL_REPORT_LINKS(stationId).filter((l) => WEB_REPORT_KEYS.includes(l.pageKey))

/**
 * The reports, grouped by domain, mirroring store-portal's REPORT_SECTIONS
 * (app/business/[slug]/reports/page.js). Eleven rows in one undifferentiated block is a list
 * you scan rather than a list you navigate.
 *
 * Built by picking pageKeys out of REPORT_LINKS rather than restating the destinations, so a
 * report added there cannot go missing here, and href/icon/desc have exactly one definition.
 *
 * Grouped by what each report CONTAINS, not what it is called:
 *   - Daily Sales Report is a per-day fuel operations sheet (pumps, tanks, lodgements, cash),
 *     so it sits with Sales Operation, the per-shift version of the same job, under Sales.
 *   - Analytics is under Sales, matching where store-portal files its Store Analytics.
 *   - Product Received is fuel-tanker discharge (waybill, truck, depot, tank dips), which is
 *     stock arriving rather than a purchase report, so it is Stock.
 *   - Audit Report sits in Cash & Accounts. It is not store's "Activity" (a who-did-what log);
 *     it is a multi-sheet financial pack, and its sheets reach past cash into stock position
 *     and consumption. It lived in a group of its own for that reason, and a one-item group
 *     read as a mistake on screen, so it was moved here by decision. Its cash sheets
 *     (sales/cash position, lodgement sheet) are the ones that justify the placement.
 *
 * `column` is which side of the two-column desktop layout the group sits in. It is declared
 * here rather than left to the layout because the two are one decision: Sales and Stock read
 * as a pair (what was sold, what it was sold out of) and belong in the same column, which a
 * height-balancing layout would not know and would split wherever the rows happened to fall.
 * Below lg the columns stack and everything renders in this order regardless.
 */
const REPORT_GROUPS = [
  // Daily Sales Report leads: it is the sheet that gets opened every day. Summary follows it.
  { title: 'Sales', column: 1, keys: ['report-daily-sales', 'report-summary', 'report-sales-overview', 'report-sales-operation', 'report-analytics'] },
  { title: 'Stock', column: 1, keys: ['report-audit-consumption', 'report-inventory-log', 'report-product-received', 'report-lube'] },
  { title: 'Cash & Accounts', column: 2, keys: ['report-account-ledger', 'imprest', 'report-audit'] },
]

/** The columns the desktop layout renders, in order. */
export const REPORT_COLUMNS = [1, 2]

/**
 * The grouped reports for a station. Groups that end up empty are dropped, so no bare heading
 * is left behind, and any report missing from REPORT_GROUPS is appended under "Other" rather
 * than silently disappearing from the hub.
 */
export function REPORT_SECTIONS(stationId) {
  const links = REPORT_LINKS(stationId)
  const byKey = new Map(links.map((l) => [l.pageKey, l]))
  const sections = REPORT_GROUPS
    .map((g) => ({ title: g.title, column: g.column, items: g.keys.map((k) => byKey.get(k)).filter(Boolean) }))
    .filter((g) => g.items.length > 0)

  // Anything not placed in a group lands in the shorter column, so a report added to
  // REPORT_LINKS without a group still appears rather than disappearing from the hub.
  const grouped = new Set(REPORT_GROUPS.flatMap((g) => g.keys))
  const ungrouped = links.filter((l) => !grouped.has(l.pageKey))
  if (ungrouped.length > 0) sections.push({ title: 'Other', column: 2, items: ungrouped })
  return sections
}

/** What the permissions UI offers. Unchanged from the hub's originals — see the note above. */
export const ENTRY_PERMISSION_OPTIONS = [
  { key: 'daily-sales', label: 'Daily Sales' },
  { key: 'product-receipt', label: 'Product Receipt' },
  { key: 'lodgements', label: 'Lodgements' },
  { key: 'lube', label: 'Lube' },
  { key: 'customer-payments', label: 'Accounts' },
]

export const REPORT_PERMISSION_OPTIONS = [
  { key: 'report-summary', label: 'Summary' },
  { key: 'report-daily-sales', label: 'Daily Sales Report' },
  { key: 'report-sales-operation', label: 'Sales Operation' },
  // These three were destinations with no toggle, so restricted staff could never open them
  // however their permissions were set. Adding them makes the reports grantable; they are
  // covered by the default ALL_PAGE_KEYS, so an unrestricted member is unaffected.
  { key: 'report-sales-overview', label: 'Sales Overview' },
  { key: 'report-inventory-log', label: 'Inventory Log' },
  { key: 'report-analytics', label: 'Analytics' },
  { key: 'report-audit', label: 'Audit Report', children: [
    { key: 'report-audit-sales-cash', label: 'Sales/Cash Position' },
    { key: 'report-audit-lodgement-sheet', label: 'Lodgement Sheet' },
    { key: 'report-audit-stock-position', label: 'Record of Stock Position' },
    { key: 'report-audit-stock-summary', label: 'Stock Position' },
    { key: 'report-audit-consumption', label: 'Consumption & Pour Back' },
    { key: 'report-audit-calculator', label: 'Calculator' },
    { key: 'report-audit-product-received', label: 'Product Received' },
  ]},
  { key: 'report-account-ledger', label: 'Account Ledger' },
  { key: 'report-product-received', label: 'Product Received' },
  { key: 'report-lube', label: 'Lube Report' },
  { key: 'imprest', label: 'Imprest' },
]

/** Every key the permissions UI can grant. The default for an unrestricted member. */
export const ALL_PAGE_KEYS = [
  ...ENTRY_PERMISSION_OPTIONS.map((p) => p.key),
  ...REPORT_PERMISSION_OPTIONS.flatMap((p) => (p.children ? [p.key, ...p.children.map((c) => c.key)] : [p.key])),
]

/**
 * Destinations that exist but can never be granted, because they are missing from the
 * permission options above. Exported so the gap is greppable and testable rather than
 * something you rediscover by wondering why a staff member cannot open a report.
 */
export const MISSING_PERMISSION_KEYS = ALL_REPORT_LINKS('x')
  .map((l) => l.pageKey)
  .filter((k) => !ALL_PAGE_KEYS.includes(k))

/** May this user open a destination? Owners see everything. */
export function canAccessPage(pageKey, { isOwner, visiblePages }) {
  return !!isOwner || (visiblePages || []).includes(pageKey)
}

/**
 * The full navigation for a station, grouped, with each destination marked allowed or not.
 * Blocked destinations are RETURNED rather than filtered out: the hub shows them dimmed and
 * explains on tap, which tells a member the feature exists and who to ask.
 */
export function buildStationNav(stationId, { isOwner, visiblePages } = {}) {
  const mark = (l) => ({ ...l, allowed: canAccessPage(l.pageKey, { isOwner, visiblePages }) })
  return [
    { heading: 'Entries', links: ENTRY_LINKS(stationId).map(mark) },
    { heading: 'Reports', links: REPORT_LINKS(stationId).map(mark) },
  ]
}
