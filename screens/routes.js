'use client'

import { lazy } from 'react'

/**
 * Every screen of the Ionic app (components/shell/IonicShell.js), by area. Each loads on
 * first open, so a phone downloads only the screens it uses.
 *
 *   path    React Router's pattern: :stationId and :id are the old [stationId] and [id]
 *   title   the top bar's words
 *   report  a full-height report: it pins its own controls, so no footer under it
 *   ranged  a report over a date range (components/reports/DateRange.js): without a
 *           subscription Screen.js puts the free-range banner above it
 *   service the subscription the screen needs on this computer (lib/local/licence.js): past its
 *           date the screen is locked, as Screen.js shows. Without one, always open: daily
 *           sales, lodgements and most reports are free (a report's range over 5 days is paid,
 *           lib/reportRange.js).
 *
 * Desktop build: no admin area, and no feedback, notifications or subscribe screens (a
 * subscription is bought on the web).
 */

export const DASHBOARD_SCREENS = [
  { path: '/dashboard', title: 'Dashboard', Page: lazy(() => import('@/screens/dashboard/page')) },
  { path: '/dashboard/entries', title: 'Entries', Page: lazy(() => import('@/screens/dashboard/entries/page')) },
  { path: '/dashboard/entries/customer-payments', title: 'Account Payment', Page: lazy(() => import('@/screens/dashboard/entries/customer-payments/page')), service: 'customer-payments' },
  { path: '/dashboard/entries/customer-payments/list', title: 'Account Entries', Page: lazy(() => import('@/screens/dashboard/entries/customer-payments/list/page')), service: 'customer-payments' },
  { path: '/dashboard/entries/daily-sales', title: 'Daily Sales', Page: lazy(() => import('@/screens/dashboard/entries/daily-sales/page')) },
  { path: '/dashboard/entries/daily-sales/list', title: 'Daily Sales Entries', Page: lazy(() => import('@/screens/dashboard/entries/daily-sales/list/page')) },
  { path: '/dashboard/entries/lodgements', title: 'Lodgements', Page: lazy(() => import('@/screens/dashboard/entries/lodgements/page')) },
  { path: '/dashboard/entries/lodgements/list', title: 'Lodgement Entries', Page: lazy(() => import('@/screens/dashboard/entries/lodgements/list/page')) },
  { path: '/dashboard/entries/lube', title: 'Lube', Page: lazy(() => import('@/screens/dashboard/entries/lube/page')), service: 'lube-management' },
  { path: '/dashboard/entries/lube/list', title: 'Lube Entries', Page: lazy(() => import('@/screens/dashboard/entries/lube/list/page')), service: 'lube-management' },
  { path: '/dashboard/entries/product-receipt', title: 'Product Receipt', Page: lazy(() => import('@/screens/dashboard/entries/product-receipt/page')), service: 'fuel-operations' },
  { path: '/dashboard/entries/product-receipt/list', title: 'Receipt Entries', Page: lazy(() => import('@/screens/dashboard/entries/product-receipt/list/page')), service: 'fuel-operations' },
  { path: '/dashboard/reports/account-ledger', title: 'Account Ledger', Page: lazy(() => import('@/screens/dashboard/reports/account-ledger/page')), report: true, service: 'customer-payments' },
  { path: '/dashboard/reports/analytics', title: 'Analytics', Page: lazy(() => import('@/screens/dashboard/reports/analytics/page')), report: true, ranged: true },
  { path: '/dashboard/reports/audit-report', title: 'Audit Report', Page: lazy(() => import('@/screens/dashboard/reports/audit-report/page')), report: true, ranged: true },
  { path: '/dashboard/reports/daily-sales-report', title: 'Daily Sales Report', Page: lazy(() => import('@/screens/dashboard/reports/daily-sales-report/page')), report: true, ranged: true },
  { path: '/dashboard/reports/dip-calculator', title: 'Dip Calculator', Page: lazy(() => import('@/screens/dashboard/reports/dip-calculator/page')), report: true },
  { path: '/dashboard/reports/imprest', title: 'Imprest', Page: lazy(() => import('@/screens/dashboard/reports/imprest/page')), report: true, service: 'fuel-operations' },
  { path: '/dashboard/reports/inventory-log', title: 'Inventory Log', Page: lazy(() => import('@/screens/dashboard/reports/inventory-log/page')), report: true, ranged: true },
  { path: '/dashboard/reports/lube-report', title: 'Lube Report', Page: lazy(() => import('@/screens/dashboard/reports/lube-report/page')), report: true, ranged: true, service: 'lube-management' },
  { path: '/dashboard/reports/product-received', title: 'Product Received', Page: lazy(() => import('@/screens/dashboard/reports/product-received/page')), report: true, ranged: true },
  { path: '/dashboard/reports/sales-operation', title: 'Sales Operation', Page: lazy(() => import('@/screens/dashboard/reports/sales-operation/page')), report: true, ranged: true },
  { path: '/dashboard/reports/sales-overview', title: 'Sales Overview', Page: lazy(() => import('@/screens/dashboard/reports/sales-overview/page')), report: true, ranged: true },
  { path: '/dashboard/reports/summary', title: 'Summary', Page: lazy(() => import('@/screens/dashboard/reports/summary/page')), report: true, ranged: true },
  { path: '/dashboard/setup/:stationId', title: 'Setup', Page: lazy(() => import('@/screens/dashboard/setup/[stationId]/page')) },
  { path: '/dashboard/stations/:stationId', title: 'Station', Page: lazy(() => import('@/screens/dashboard/stations/[stationId]/page')) },
  { path: '/dashboard/stations/:stationId/settings', title: 'Settings', Page: lazy(() => import('@/screens/dashboard/stations/[stationId]/settings/page')) },
]
