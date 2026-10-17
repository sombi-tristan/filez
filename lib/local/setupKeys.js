/**
 * What makes two rows of a station's setup the same thing: the web allows one pump per fuel and
 * number and one tank per fuel and number (station_pumps, station_tanks UNIQUE), and the screens
 * one bank per name and lodgement type, one customer and one lube product per name. Used by a
 * restore (lib/local/restoreInto.js), the replace of the web copy and pull (lib/local/webSync.js).
 * Pinned by tests/desktop-sync-checks.test.mjs.
 */
const norm = (v) => String(v ?? '').trim().toLowerCase()

export const SETUP_KEYS = {
  station_tanks: { key: (r) => `${norm(r.fuel_type)}|${Number(r.tank_number)}`, label: (r) => `${r.fuel_type} tank ${r.tank_number}` },
  station_pumps: { key: (r) => `${norm(r.fuel_type)}|${Number(r.pump_number)}`, label: (r) => `${r.fuel_type} ${r.pump_number}` },
  station_banks: { key: (r) => `${norm(r.bank_name)}|${norm(r.lodgement_type)}`, label: (r) => `${String(r.bank_name || '').trim()} (${r.lodgement_type})` },
  station_customers: { key: (r) => norm(r.name), label: (r) => r.name },
  station_lube_products: { key: (r) => norm(r.product_name), label: (r) => r.product_name },
}

/** The setup rows held more than once: [{ table, label, count, ids }]. */
export function findDoubles(rowsByTable) {
  const out = []
  for (const [table, { key, label }] of Object.entries(SETUP_KEYS)) {
    const groups = new Map()
    for (const row of rowsByTable[table] || []) {
      const k = key(row)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(row)
    }
    for (const rows of groups.values()) {
      if (rows.length > 1) out.push({ table, label: label(rows[0]), count: rows.length, ids: rows.map((r) => r.id) })
    }
  }
  return out
}
