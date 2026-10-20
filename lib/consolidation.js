/**
 * The date before which entries are already consolidated.
 *
 * The weekly job (public.consolidate_entries, supabase/migrations/044, scheduled every Sunday at
 * 02:00 UTC) rolls entries dated before CURRENT_DATE - 90 into the opening balances (banks,
 * lube stock, customers, tanks, pump meters) and deletes them. An entry for such a date that
 * arrives afterwards, from a phone or a computer that was offline for weeks, would count twice:
 * once in the opening balance and once as an entry. So the entry routes and the desktop push
 * refuse it, and say why.
 *
 * The cutoff is the last run's, not today's minus 90: between runs, entries 90 to 97 days old
 * are still here as entries and may be changed.
 */

/** The tables the job consolidates. Consumption and imprest entries are not. */
export const CONSOLIDATED_TABLES = [
  'daily_sales_entries',
  'product_receipt_entries',
  'lodgement_entries',
  'lube_sales_entries',
  'lube_stock_entries',
  'customer_payment_entries',
]

const DAY = 24 * 60 * 60 * 1000

/** The cutoff of the last run at or before `now`, as YYYY-MM-DD: entries dated before it are gone. */
export function consolidatedBefore(now = new Date()) {
  const lastRun = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2))
  lastRun.setUTCDate(lastRun.getUTCDate() - lastRun.getUTCDay())
  if (lastRun > now) lastRun.setUTCDate(lastRun.getUTCDate() - 7)
  const runDay = Date.UTC(lastRun.getUTCFullYear(), lastRun.getUTCMonth(), lastRun.getUTCDate())
  return new Date(runDay - 90 * DAY).toISOString().slice(0, 10)
}

/** Why an entry for this table and date is refused, or null when it may be written. */
export function consolidatedEntryError(table, entryDate, now = new Date()) {
  if (!entryDate || !CONSOLIDATED_TABLES.includes(table)) return null
  const cutoff = consolidatedBefore(now)
  if (String(entryDate).slice(0, 10) >= cutoff) return null
  return `This entry is for ${String(entryDate).slice(0, 10)}, older than 3 months. Entries before ${cutoff} are already in the opening balances, so it was not saved.`
}
