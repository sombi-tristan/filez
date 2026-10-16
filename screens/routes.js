'use client'

import { lazy } from 'react'

/**
 * Every screen of the two Ionic apps (components/shell/IonicShell.js), by area. Each loads on
 * first open, so a phone downloads only the screens it uses.
 *
 *   path    React Router's pattern: :stationId and :id are the old [stationId] and [id]
 *   title   the top bar's words
 *   report  a full-height report: it pins its own controls, so no footer under it
 *   desktopOnly  a report the web does not keep (lib/platform.js): it is in the desktop app,
 *           and Screen.js says so instead of opening it
 */

export const DASHBOARD_SCREENS = [
  { path: '/dashboard', title: 'Dashboard', Page: lazy(() => import('@/screens/dashboard/page')) },
  { path: '/dashboard/computers', title: 'Linked computers', Page: lazy(() => import('@/screens/dashboard/computers/page')) },
  { path: '/dashboard/entries', title: 'Entries', Page: lazy(() => import('@/screens/dashboard/entries/page')) },
  { path: '/dashboard/entries/customer-payments', title: 'Account Payment', Page: lazy(() => import('@/screens/dashboard/entries/customer-payments/page')) },
  { path: '/dashboard/entries/customer-payments/list', title: 'Account Entries', Page: lazy(() => import('@/screens/dashboard/entries/customer-payments/list/page')) },
  { path: '/dashboard/entries/daily-sales', title: 'Daily Sales', Page: lazy(() => import('@/screens/dashboard/entries/daily-sales/page')) },
  { path: '/dashboard/entries/daily-sales/list', title: 'Daily Sales Entries', Page: lazy(() => import('@/screens/dashboard/entries/daily-sales/list/page')) },
  { path: '/dashboard/entries/lodgements', title: 'Lodgements', Page: lazy(() => import('@/screens/dashboard/entries/lodgements/page')) },
  { path: '/dashboard/entries/lodgements/list', title: 'Lodgement Entries', Page: lazy(() => import('@/screens/dashboard/entries/lodgements/list/page')) },
  { path: '/dashboard/entries/lube', title: 'Lube', Page: lazy(() => import('@/screens/dashboard/entries/lube/page')) },
  { path: '/dashboard/entries/lube/list', title: 'Lube Entries', Page: lazy(() => import('@/screens/dashboard/entries/lube/list/page')) },
  { path: '/dashboard/entries/product-receipt', title: 'Product Receipt', Page: lazy(() => import('@/screens/dashboard/entries/product-receipt/page')) },
  { path: '/dashboard/entries/product-receipt/list', title: 'Receipt Entries', Page: lazy(() => import('@/screens/dashboard/entries/product-receipt/list/page')) },
  { path: '/dashboard/feedback', title: 'Help & feedback', Page: lazy(() => import('@/screens/dashboard/feedback/page')) },
  { path: '/dashboard/reports/account-ledger', title: 'Account Ledger', Page: lazy(() => import('@/screens/dashboard/reports/account-ledger/page')), report: true },
  { path: '/dashboard/reports/analytics', title: 'Analytics', Page: lazy(() => import('@/screens/dashboard/reports/analytics/page')), report: true },
  { path: '/dashboard/reports/audit-report', title: 'Audit Report', Page: lazy(() => import('@/screens/dashboard/reports/audit-report/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/daily-sales-report', title: 'Daily Sales Report', Page: lazy(() => import('@/screens/dashboard/reports/daily-sales-report/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/dip-calculator', title: 'Dip Calculator', Page: lazy(() => import('@/screens/dashboard/reports/dip-calculator/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/imprest', title: 'Imprest', Page: lazy(() => import('@/screens/dashboard/reports/imprest/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/inventory-log', title: 'Inventory Log', Page: lazy(() => import('@/screens/dashboard/reports/inventory-log/page')), report: true },
  { path: '/dashboard/reports/lube-report', title: 'Lube Report', Page: lazy(() => import('@/screens/dashboard/reports/lube-report/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/product-received', title: 'Product Received', Page: lazy(() => import('@/screens/dashboard/reports/product-received/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/sales-operation', title: 'Sales Operation', Page: lazy(() => import('@/screens/dashboard/reports/sales-operation/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/sales-overview', title: 'Sales Overview', Page: lazy(() => import('@/screens/dashboard/reports/sales-overview/page')), report: true, desktopOnly: true },
  { path: '/dashboard/reports/summary', title: 'Summary', Page: lazy(() => import('@/screens/dashboard/reports/summary/page')), report: true },
  { path: '/dashboard/setup/:stationId', title: 'Setup', Page: lazy(() => import('@/screens/dashboard/setup/[stationId]/page')) },
  { path: '/dashboard/stations/:stationId', title: 'Station', Page: lazy(() => import('@/screens/dashboard/stations/[stationId]/page')) },
  { path: '/dashboard/stations/:stationId/notifications', title: 'Notifications', Page: lazy(() => import('@/screens/dashboard/stations/[stationId]/notifications/page')) },
  { path: '/dashboard/stations/:stationId/settings', title: 'Settings', Page: lazy(() => import('@/screens/dashboard/stations/[stationId]/settings/page')) },
  { path: '/dashboard/subscribe', title: 'Subscribe', Page: lazy(() => import('@/screens/dashboard/subscribe/page')) },
  { path: '/dashboard/subscribe/pay/:id', title: 'Payment', Page: lazy(() => import('@/screens/dashboard/subscribe/pay/[id]/page')) },
]

export const ADMIN_SCREENS = [
  { path: '/admin', title: 'Subscriptions', Page: lazy(() => import('@/screens/admin/page')) },
  { path: '/admin/analytics', title: 'Analytics', Page: lazy(() => import('@/screens/admin/analytics/page')) },
  { path: '/admin/excel-templates', title: 'Excel Templates', Page: lazy(() => import('@/screens/admin/excel-templates/page')) },
  { path: '/admin/services', title: 'Services', Page: lazy(() => import('@/screens/admin/services/page')) },
  { path: '/admin/settings', title: 'Stations', Page: lazy(() => import('@/screens/admin/settings/page')) },
  { path: '/admin/users', title: 'Staff', Page: lazy(() => import('@/screens/admin/users/page')) },
]
