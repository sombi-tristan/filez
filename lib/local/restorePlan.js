import { LOCAL_STATION_ID } from './constants'

/**
 * Desktop build: where a backup goes on a computer that holds several stations, decided before
 * anything is written (lib/local/routes/local/backup/route.js). Pure, so
 * tests/desktop-restore.test.mjs pins it.
 *
 * A backup is one station. It is added beside the stations here, or replaces only that same
 * station; it is never merged into a different one, so its setup and opening balances come in
 * exactly once, as they are in the backup.
 *
 *   here  the stations on this computer: [{ id, pumps: [the ids of its pumps and tanks] }]
 *
 * Returns
 *
 *   { ok: true, into, replace: false }   a station not here: added under its own id
 *   { ok: true, into, replace: true }    the same station: its records here are replaced
 *   { ok: true, fresh: true }            a different station made offline that shares the fixed
 *                                        local id with one here: added under a new id
 *   { ok: false, error }                 not a backup of one station
 *
 * A station here that shares a pump or tank with the backup is that station (also one added
 * from this backup before, under a new id). Otherwise web stations have ids of their own, so the
 * same id is the same station; stations made offline on different computers all share the fixed
 * local id, and one is the same station only while it has no setup yet.
 */
export function restorePlan(backup, { here = [] } = {}) {
  const stations = backup?.tables?.organizations || []
  if (stations.length !== 1) return { ok: false, error: 'That file is not a backup of one station' }
  const id = stations[0].id

  const theirs = new Set([...(backup.tables.station_pumps || []), ...(backup.tables.station_tanks || [])].map((r) => r.id))
  const sharer = here.find((s) => s.pumps.some((p) => theirs.has(p)))
  if (sharer) return { ok: true, into: sharer.id, replace: true }

  const existing = here.find((s) => s.id === id)
  if (!existing) return { ok: true, into: id, replace: false }
  if (id !== LOCAL_STATION_ID || !existing.pumps.length) return { ok: true, into: id, replace: true }
  return { ok: true, fresh: true, replace: false }
}
