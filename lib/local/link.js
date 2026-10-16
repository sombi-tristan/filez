import { LOCAL_STATION_ID } from './constants'

/**
 * Which web station this computer is linked to (app/api/desktop/link on the web), kept in
 * localStorage so the screens can read it at once. The device token is not here: Electron's
 * main process holds it, encrypted, and adds it to every request to the web (electron/web.js).
 *
 *   { stationId, stationName, ownerId, ownerName, ownerEmail, linkedAt, lastPushAt, lastPullAt }
 */
const KEY = 'stationmgr.link'

export function getLink() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null }
}

export function setLink(link) {
  try {
    if (link) localStorage.setItem(KEY, JSON.stringify(link))
    else localStorage.removeItem(KEY)
  } catch { /* storage unavailable */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stationmgr:link'))
}

export function updateLink(patch) {
  const link = getLink()
  if (link) setLink({ ...link, ...patch })
}

/**
 * The station this computer works on: the linked web station, or for a computer set up before
 * linking existed, the fixed local id its records were made under until it links.
 */
export function getLinkedStationId() {
  return getLink()?.stationId || LOCAL_STATION_ID
}
