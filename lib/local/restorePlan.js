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
