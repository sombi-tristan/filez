import { importSPKI, jwtVerify } from 'jose'
import { getLink } from './link'

/**
 * The station's subscriptions on this computer, checked with no internet.
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
const LICENCE_KEY = 'stationmgr.licence'
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

/** Notes the time now, and says whether the clock has gone back a day or more. */
function clockWentBack(now = Date.now()) {
  const latest = Number(read(CLOCK_KEY)) || 0
  if (latest && now < latest - DAY) return true
  if (now > latest) write(CLOCK_KEY, String(now))
  return false
}

/**
 * Verifies and keeps a licence from the web. A licence that does not verify, or names another
 * station, is not kept. Also resets the clock check to the time the web signed it.
 */
export async function saveLicence(token) {
  const { payload } = await jwtVerify(token, await getPublicKey(), { issuer: ISSUER, audience: AUDIENCE })
  const link = getLink()
  if (link?.stationId && payload.sub !== link.stationId) throw new Error('That licence is for another station')
  write(LICENCE_KEY, token)
  write(CLOCK_KEY, String(Math.max(Date.now(), (payload.iat || 0) * 1000)))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('stationmgr:licence'))
  return payload
}

export function forgetLicence() {
  write(LICENCE_KEY, null)
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
export async function checkLicence(now = Date.now()) {
  latest = await evaluate(now)
  return latest
}

// The last answer, for checks that cannot wait (paidNow). components/desktop/LicenceGate.js
// checks before any screen opens and again whenever a licence arrives.
let latest = null

/**
 * Whether the paid features are open: backup, reports longer than 5 days, push and pull. Any
 * running service opens them. Synchronous, from the last check.
 */
export function paidNow() {
  return Boolean(latest && latest.status === 'ok' && latest.anyActive)
}

async function evaluate(now) {
  const link = getLink()
  const empty = { services: {}, active: {}, anyActive: false, issuedAt: null }
  if (!link?.stationId) return { status: 'unlinked', ...empty }
  const token = read(LICENCE_KEY)
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
export async function serviceRunning(serviceKey) {
  const state = await checkLicence()
  return state.status === 'ok' && Boolean(state.active[serviceKey])
}
