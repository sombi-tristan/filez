/**
 * The tables a linked StationMGR Desktop computer pulls from and pushes to the web station
 * (app/api/desktop/pull and push). Shared by the web and the desktop build so the two cannot
 * disagree about what moves.
 *
 *   service  the subscription a push to this table needs, as on the web (lib/entryHelpers.js
 *            ENTRY_SERVICE_MAP). Station setup needs none, and neither do daily sales and
 *            lodgements: they are the desktop's free entries. Push and pull themselves need
 *            any service running (lib/desktop.js anyServiceRunning).
 *   columns  for organizations, the only columns a computer may change: it never moves a
 *            station to another owner or group.
 *   entries  rows are soft-deleted (deleted_at): a delete from a computer marks the row, it
 *            never removes it.
 *
 * Not here, on purpose: users and org_invites (the computer's staff and their PINs stay on the
 * computer), subscriptions and services (the web's to grant), messages and admin logs.
 */
export const SYNC_TABLES = {
  organizations: { columns: ['name', 'location', 'onboarding_complete'] },
  station_tanks: {},
  station_pumps: {},
  station_banks: {},
  station_lube_products: {},
  station_customers: {},
  daily_sales_entries: { entries: true },
  product_receipt_entries: { service: 'fuel-operations', entries: true },
  lodgement_entries: { entries: true },
  imprest_periods: { service: 'fuel-operations' },
  imprest_entries: { service: 'fuel-operations', entries: true },
  lube_sales_entries: { service: 'lube-management', entries: true },
  lube_stock_entries: { service: 'lube-management', entries: true },
  customer_payment_entries: { service: 'customer-payments', entries: true },
}

/** Push in this order, so a row arrives after the rows it points at (a pump after its tank). */
export const PUSH_ORDER = Object.keys(SYNC_TABLES)

/** The biggest batch one push request carries. */
export const PUSH_BATCH = 200
