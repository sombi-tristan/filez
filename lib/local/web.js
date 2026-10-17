/**
 * The way to the web platform, through Electron's main process (electron/web.js, exposed by
 * electron/preload.js as window.stationmgr). The page itself cannot reach the internet: every
 * http(s) request it makes is refused. Main talks to the one web address the app was built for,
 * adds the device token, and returns { ok, status, body }.
 *
 * Outside Electron (the export opened in a browser while developing) there is no bridge, and
 * every call answers that the web cannot be reached.
 */
import { getCurrentStationId } from './link'

function bridge() {
  return typeof window !== 'undefined' ? window.stationmgr : null
}

const NO_BRIDGE = { ok: false, status: 0, body: { error: 'The web can only be reached from the StationMGR desktop app.' } }

export function hasWebBridge() {
  return Boolean(bridge())
}

/**
 * Link this computer: the owner's web email and password, and the station once chosen, or
 * createName for a new web station made for this computer's records.
 */
export async function linkComputer({ email, password, stationId, createName }) {
  const b = bridge()
  return b ? b.link({ email, password, stationId, createName }) : NO_BRIDGE
}

/**
 * Signing in or up with the web account (app/api/desktop/sign-in, sign-up): no device token,
 * since the person is not yet known here. lib/local/accounts.js uses it.
 */
export async function webAccount(path, body) {
  const b = bridge()
  return b?.account ? b.account({ path, body }) : NO_BRIDGE
}

/** A request to the web as a linked station (the one open now by default), with its device token. */
export async function webGet(path, stationId = getCurrentStationId()) {
  const b = bridge()
  return b ? b.request({ method: 'GET', path, stationId }) : NO_BRIDGE
}

export async function webPost(path, body, stationId = getCurrentStationId()) {
  const b = bridge()
  return b ? b.request({ method: 'POST', path, body, stationId }) : NO_BRIDGE
}

/** Forget a station's device token. The web keeps the record; revoke it there to stop it for good. */
export async function unlinkComputer(stationId = getCurrentStationId()) {
  const b = bridge()
  return b ? b.unlink(stationId) : { ok: true }
}

/** Opens a page of the web platform in the person's browser (to renew a subscription). */
export function openWeb(path) {
  bridge()?.openWeb(path)
}
