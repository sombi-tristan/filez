import { LOCAL_STATION_ID } from './constants'

/**
 * The stations on this computer and their web links, kept in localStorage so the screens can
 * read them at once. A computer holds several stations; each may be linked to its own web
 * station (app/api/desktop/link on the web) or stay offline only. The device tokens are not
 * here: Electron's main process holds one per linked station, encrypted, and adds it to every
 * request to the web (electron/web.js).
 *
 *   links    { [stationId]: { stationId, stationName, ownerId, ownerName, ownerEmail, linkedAt,
 *                             lastPushAt, lastPullAt, revoked } }
 *   current  the station open now: the screens, the licence checks and a backup follow it
 *
 * A computer from before kept one link under 'stationmgr.link'; it becomes that station's.
 */
const LINKS_KEY = 'stationmgr.links'
const CURRENT_KEY = 'stationmgr.current'
const OLD_LINK_KEY = 'stationmgr.link'

function read(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}
function changed() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stationmgr:link'))
}

function readLinks() {
  let links = null
  try { links = JSON.parse(read(LINKS_KEY) || 'null') } catch { links = null }
  if (links) return links
  // A computer from before: its one link moves here, once.
  let old = null
  try { old = JSON.parse(read(OLD_LINK_KEY) || 'null') } catch { old = null }
  links = old?.stationId ? { [old.stationId]: old } : {}
  write(LINKS_KEY, JSON.stringify(links))
  write(OLD_LINK_KEY, null)
  return links
}

/** Every linked station's link. */
export function allLinks() {
  return Object.values(readLinks())
}

/**
 * The station open now. Until one is chosen: the station a computer from before was linked to,
 * or the fixed local id a computer set up before linking existed made its records under.
 */
export function getCurrentStationId() {
  return read(CURRENT_KEY) || allLinks()[0]?.stationId || LOCAL_STATION_ID
}

export function setCurrentStationId(stationId) {
  if (stationId === getCurrentStationId() && read(CURRENT_KEY)) return
  write(CURRENT_KEY, stationId || null)
  changed()
}

/** A station's web link (the station open now by default), or null when it is offline only. */
export function getLink(stationId = getCurrentStationId()) {
  return readLinks()[stationId] || null
}

/** Keeps a station's link (link.stationId), or with null forgets the link of `stationId`. */
export function setLink(link, stationId = link?.stationId || getCurrentStationId()) {
  const links = readLinks()
  if (link) links[link.stationId] = link
  else delete links[stationId]
  write(LINKS_KEY, JSON.stringify(links))
  changed()
}

export function updateLink(patch, stationId = getCurrentStationId()) {
  const link = getLink(stationId)
  if (link) setLink({ ...link, ...patch })
}

/** The station the screens work on: the one open now (kept under its old name for its callers). */
export function getLinkedStationId() {
  return getCurrentStationId()
}
