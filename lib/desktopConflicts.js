/**
 * What the web answers a desktop push refused for a duplicate (a unique rule, Postgres 23505):
 * the real conflict, so the computer's push window says what is in the way
 * (app/api/desktop/push). Pinned by tests/desktop-conflicts.test.mjs.
 */
export function conflictMessage(table, row = {}) {
  if (table === 'station_pumps') return `${row.fuel_type} ${row.pump_number} is already a pump on the web station (under another record)`
  if (table === 'station_tanks') return `${row.fuel_type} tank ${row.tank_number} is already a tank on the web station (under another record)`
  if (table === 'daily_sales_entries') return `The web station already has a close of business for ${row.entry_date}`
  return 'That record is already on the web station'
}
