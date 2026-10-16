/**
 * The way to the web platform, through Electron's main process (electron/web.js, exposed by
 * electron/preload.js as window.stationmgr). The page itself cannot reach the internet: every
 * http(s) request it makes is refused. Main talks to the one web address the app was built for,
 * adds the device token, and returns { ok, status, body }.
 *
 * Outside Electron (the export opened in a browser while developing) there is no bridge, and
 * every call answers that the web cannot be reached.
 */
function bridge() {
  return typeof window !== 'undefined' ? window.stationmgr : null
}

const NO_BRIDGE = { ok: false, status: 0, body: { error: 'The web can only be reached from the StationMGR desktop app.' } }

export function hasWebBridge() {
  return Boolean(bridge())
}

/** Link this computer: the owner's web email and password, and the station once chosen. */
export async function linkComputer({ email, password, stationId }) {
  const b = bridge()
  return b ? b.link({ email, password, stationId }) : NO_BRIDGE
}

export async function webGet(path) {
  const b = bridge()
  return b ? b.request({ method: 'GET', path }) : NO_BRIDGE
}

export async function webPost(path, body) {
  const b = bridge()
  return b ? b.request({ method: 'POST', path, body }) : NO_BRIDGE
}

/** Forget the device token. The web keeps the record; revoke it there to stop it for good. */
export async function unlinkComputer() {
  const b = bridge()
  return b ? b.unlink() : { ok: true }
}

/** Opens a page of the web platform in the person's browser (to renew a subscription). */
export function openWeb(path) {
  bridge()?.openWeb(path)
}
