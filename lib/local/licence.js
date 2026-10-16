import { importSPKI, jwtVerify } from 'jose'
import { getLink, getCurrentStationId } from './link'

/**
 * Each station's subscriptions on this computer, checked with no internet. A computer holds
 * several stations; each linked one keeps its own licence, and the checks follow the station
 * open now unless told which (lib/local/link.js).
 *
 * The web signs a licence for a linked computer on every link, push, pull and licence refresh
 * (lib/desktop.js on the web): each service the station has, and the day it stops working here
 * (its end date plus the 7-day grace). It is kept as the signed token and checked against the
 * public key the app was built with, so it cannot be edited or made up on this computer.
 *
 * A computer whose clock is set back to stretch a licence is caught by the latest time this app
 * has seen: a clock more than a day behind it closes the paid features until the web is reached again and
 * a fresh licence resets it.
 */
// Each station's licence is kept under its own key; a computer from before kept its one under
// the bare key, which becomes its linked station's.
const OLD_LICENCE_KEY = 'stationmgr.licence'
const licenceKey = (stationId) => `stationmgr.licence:${stationId}`
const CLOCK_KEY = 'stationmgr.clock'
const DAY = 24 * 60 * 60 * 1000

export const ISSUER = 'stationmgr'
export const AUDIENCE = 'stationmgr-desktop'

let publicKey = null
async function getPublicKey() {
  if (publicKey) return publicKey
  const pem = (process.env.NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY || '').replace(/\\n/g, '\n')
  if (!pem.includes('PUBLIC KEY')) throw new Error('This build has no licence key')
  publicKey = await importSPKI(pem, 'ES256')
  return publicKey
}

function read(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function write(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* unavailable */ }
}

function readLicence(stationId) {
  const kept = read(licenceKey(stationId))
  if (kept) return kept
  const old = read(OLD_LICENCE_KEY)
  if (old && getLink(stationId)) {
    write(licenceKey(stationId), old)
    write(OLD_LICENCE_KEY, null)
  }
  return old && getLink(stationId) ? old : null
}

/** Notes the time now, and says whether the clock has gone back a day or more. */
function clockWentBack(now = Date.now()) {
  const latest = Number(read(CLOCK_KEY)) || 0
  if (latest && now < latest - DAY) return true
  if (now > latest) write(CLOCK_KEY, String(now))
  return false
}

/**
 * Verifies and keeps a licence from the web, as the licence of the station it names (or of
 * `stationId`, which it must then name). A licence that does not verify is not kept. Also resets
 * the clock check to the time the web signed it.
 */
export async function saveLicence(token, stationId) {
  const { payload } = await jwtVerify(token, await getPublicKey(), { issuer: ISSUER, audience: AUDIENCE })
  if (stationId && payload.sub !== stationId) throw new Error('That licence is for another station')
  write(licenceKey(payload.sub), token)
  write(CLOCK_KEY, String(Math.max(Date.now(), (payload.iat || 0) * 1000)))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stationmgr:licence'))
  return payload
}

export function forgetLicence(stationId = getCurrentStationId()) {
  write(licenceKey(stationId), null)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stationmgr:licence'))
}

/**
 * Where this computer stands:
 *
 *   status    'unlinked'  not linked to a web station yet
 *             'missing'   linked, but no licence kept (or this build has no key)
 *             'invalid'   the kept licence does not verify, or is for another station
 *             'clock'     the clock is a day or more behind the latest time seen
 *             'ok'        checked: see services
 *   services  { [serviceKey]: ISO date it stops }, from the licence
 *   active    { [serviceKey]: true } for each still running now
 *   anyActive whether anything runs: any service opens the paid features (paidNow)
 */
export async function checkLicence(now = Date.now(), stationId = getCurrentStationId()) {
  latest[stationId] = await evaluate(now, stationId)
  return latest[stationId]
}

// Each station's last answer, for checks that cannot wait (paidNow). components/desktop/LicenceGate.js
// checks before any screen opens and again whenever a licence arrives.
const latest = {}

/**
 * Whether the paid features are open: backup, reports longer than 5 days, push and pull. Any
 * running service opens them. Synchronous, from the last check.
 */
export function paidNow(stationId = getCurrentStationId()) {
  const state = latest[stationId]
  return Boolean(state && state.status === 'ok' && state.anyActive)
}

async function evaluate(now, stationId) {
  const link = getLink(stationId)
  const empty = { services: {}, active: {}, anyActive: false, issuedAt: null }
  if (!link?.stationId) return { status: 'unlinked', ...empty }
  const token = readLicence(stationId)
  if (!token) return { status: 'missing', ...empty }

  let payload
  try {
    ;({ payload } = await jwtVerify(token, await getPublicKey(), { issuer: ISSUER, audience: AUDIENCE }))
  } catch {
    return { status: 'invalid', ...empty }
  }
  if (payload.sub !== link.stationId) return { status: 'invalid', ...empty }
  if (clockWentBack(now) || now < (payload.iat || 0) * 1000 - DAY) return { status: 'clock', ...empty, issuedAt: payload.iat }

  const services = payload.svc || {}
  const active = Object.fromEntries(Object.entries(services).filter(([, until]) => new Date(until).getTime() > now).map(([k]) => [k, true]))
  return { status: 'ok', services, active, anyActive: Object.keys(active).length > 0, issuedAt: payload.iat }
}

/** Whether a service runs now, for the in-app server's write check (lib/entryHelpers.js). */
export async function serviceRunning(serviceKey, stationId = getCurrentStationId()) {
  const state = await checkLicence(Date.now(), stationId)
  return state.status === 'ok' && Boolean(state.active[serviceKey])
}
