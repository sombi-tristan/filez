import { LOCAL_STATION_ID } from './constants'

/**
 * Desktop build: whether a backup may replace this computer's records, decided before anything
 * is wiped (lib/local/routes/local/backup/route.js). Pure, so tests/desktop-restore.test.mjs
 * pins it.
 *
 *   stationId  the station this computer works on (getLinkedStationId)
 *   linked     whether it is linked to a web station
 *
 * A backup always overwrites this computer, its setup and opening balances included. Returns
 *
 *   { ok: true }                          a backup of this station
 *   { ok: true, adoptFrom, into }         its records move from adoptFrom to into: a backup made
 *                                         before linking moves into the linked station, any
 *                                         station's backup on a computer not linked moves under
 *                                         the local id
 *   { ok: true, adoptFrom, into, unlink } a backup of another station on a linked computer: it
 *                                         moves under the local id and the computer is unlinked,
 *                                         so the owner can create (or link) its station on the web
 *   { ok: false, error }                  not a backup of one station
 */
export function restorePlan(backup, { stationId, linked }) {
  const stations = backup?.tables?.organizations || []
  if (stations.length !== 1) return { ok: false, error: 'That file is not a backup of one station' }
  const held = stations[0]
  if (held.id === stationId) return { ok: true }
  if (!linked || held.id === LOCAL_STATION_ID) return { ok: true, adoptFrom: held.id, into: stationId }
  return { ok: true, adoptFrom: held.id, into: LOCAL_STATION_ID, unlink: true }
}

/**
 * The station this linked computer holds records of besides the linked one, or null. A linked
 * computer holds only its own station; an earlier restore (1.0.2) could leave another's, either
 * alone or beside the linked one's row that a pull then brought back, owned by its web owner.
 * Either way the people here belong to the other one and cannot open the linked station, so
 * sign-in offers the way out instead of the station (app/auth/login/page.js).
 *
 *   stations  the organizations rows on this computer
 */
export function heldStation({ stationId, linked, stations }) {
  if (!linked) return null
  return stations.find((s) => s.id !== stationId) || null
}
