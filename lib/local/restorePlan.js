import { LOCAL_STATION_ID } from './constants'

/**
 * Desktop build: whether a backup may replace this computer's records, decided before anything
 * is wiped (lib/local/routes/local/backup/route.js). Pure, so tests/desktop-restore.test.mjs
 * pins it.
 *
 *   stationId  the station this computer works on (getLinkedStationId)
 *   linked     whether it is linked to a web station
 *
 * Returns { ok: true } for a backup of this station; { ok: true, adoptFrom } for one whose
 * records move into this station (a backup made before linking, or any station's backup on a
 * computer not linked); { ok: false, error } for one of another station, which would leave
 * this computer holding a station it is not linked to.
 */
export function restorePlan(backup, { stationId, linked }) {
  const stations = backup?.tables?.organizations || []
  if (stations.length !== 1) return { ok: false, error: 'That file is not a backup of one station' }
  const held = stations[0]
  if (held.id === stationId) return { ok: true }
  if (!linked || held.id === LOCAL_STATION_ID) return { ok: true, adoptFrom: held.id }
  return {
    ok: false,
    error: `That backup is of ${held.name || 'another station'}, and this computer is linked to a different station. Nothing was changed.`,
  }
}

/**
 * The station this linked computer holds records of when it is not the linked one, or null.
 * An earlier restore could leave it so: then the linked station is missing, and sign-in offers
 * to get it back from the web or to keep the one held and unlink (app/auth/login/page.js).
 *
 *   stations  the organizations rows on this computer
 */
export function heldStation({ stationId, linked, stations }) {
  if (!linked || stations.some((s) => s.id === stationId)) return null
  return stations[0] || null
}
