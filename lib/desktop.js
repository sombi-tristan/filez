import { createHash, randomBytes } from 'node:crypto'
import { importPKCS8, SignJWT } from 'jose'
import { getServiceClient } from '@/lib/entryHelpers'

/**
 * The web platform's side of StationMGR Desktop (the desktop/* branches).
 *
 * A desktop computer is linked to one web station by its owner, once, online
 * (app/api/desktop/link). It then holds a device token for push and pull, and a licence: the
 * station's services and the day each stops working, signed here so the desktop can check them
 * with no internet. Every link, licence refresh, push and pull hands it a fresh licence.
 */

const GRACE_DAYS = 7
// An approved subscription with no end date is good on an offline computer for this long; the
// computer renews it the next time it reaches the web.
const OPEN_ENDED_DAYS = 30

export const LICENCE_ISSUER = 'stationmgr'
export const LICENCE_AUDIENCE = 'stationmgr-desktop'

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

/** A new computer for the station: returns its id and the token it is shown once. */
export async function createDevice({ orgId, userId, name }) {
  const token = `dsk_${randomBytes(32).toString('base64url')}`
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('desktop_devices')
    .insert({ org_id: orgId, user_id: userId, name: String(name || '').slice(0, 120), token_hash: hashToken(token), last_seen_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) throw new Error('Could not register this computer')
  return { deviceId: data.id, token }
}

/** The token from `Authorization: Device <token>`, or null. */
export function deviceTokenFrom(request) {
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Device\s+(\S+)$/i)
  return match ? match[1] : null
}

/**
 * The linked computer making this request, its station and the owner who linked it, or null
 * when the token is unknown or the computer was revoked. The owner must still own the station.
 */
export async function authenticateDevice(request) {
  const token = deviceTokenFrom(request)
  if (!token) return null
  const supabase = getServiceClient()
  const { data: device } = await supabase
    .from('desktop_devices')
    .select('id, org_id, user_id, revoked_at')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (!device || device.revoked_at) return null

  const [{ data: user }, { data: station }] = await Promise.all([
    supabase.from('users').select('id, email, name, phone, role, org_id').eq('id', device.user_id).maybeSingle(),
    supabase.from('organizations').select('id, name, owner_id').eq('id', device.org_id).maybeSingle(),
  ])
  if (!user || !station || station.owner_id !== user.id) return null

  supabase.from('desktop_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id).then(() => {}, () => {})
  return { device, user, station }
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * The day each of the station's services stops working on an offline computer, by the web's
 * own rule (lib/entryHelpers.js requireService): an approved subscription runs to its end date
 * and a 7-day grace after it; an expired one only through that grace.
 */
export async function serviceDates(orgId) {
  const supabase = getServiceClient()
  const { data: station } = await supabase.from('organizations').select('owner_id').eq('id', orgId).maybeSingle()
  if (!station) return {}

  const { data: items } = await supabase
    .from('subscription_items')
    .select('services!inner(key), subscriptions!inner(status, user_id, org_id, end_date)')
    .eq('subscriptions.org_id', orgId)
    .eq('subscriptions.user_id', station.owner_id)
    .in('subscriptions.status', ['approved', 'expired'])

  const now = new Date()
  const dates = {}
  for (const item of items || []) {
    const key = item.services?.key
    const sub = item.subscriptions
    if (!key || !sub) continue
    let until
    if (sub.end_date) until = addDays(sub.end_date, GRACE_DAYS)
    else if (sub.status === 'approved') until = addDays(now, OPEN_ENDED_DAYS)
    else continue
    if (until <= now) continue
    if (!dates[key] || new Date(dates[key]) < until) dates[key] = until.toISOString()
  }
  return dates
}

let signingKey = null
async function getSigningKey() {
  if (signingKey) return signingKey
  const pem = (process.env.DESKTOP_LICENCE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!pem.includes('PRIVATE KEY')) throw new Error('DESKTOP_LICENCE_PRIVATE_KEY is not set')
  signingKey = await importPKCS8(pem, 'ES256')
  return signingKey
}

/**
 * The signed licence for a linked computer: { svc: { [serviceKey]: ISO date it stops } }, for
 * this station and this computer. The desktop checks the signature with the matching public key
 * (scripts/gen-desktop-licence-keys.mjs) and needs no internet to do it.
 */
/**
 * Whether the station has any service running, grace included: what push and pull need. The
 * desktop's free tier (daily sales, lodgements, short reports) stays on the computer.
 */
export async function anyServiceRunning(orgId) {
  return Object.keys(await serviceDates(orgId)).length > 0
}

/**
 * Whether the station has records on the web beyond its own row, so a computer that has records
 * too can be asked which to keep before linking (app/api/desktop/link).
 */
export async function stationHasRecords(orgId, tables) {
  const supabase = getServiceClient()
  for (const table of tables) {
    if (table === 'organizations') continue
    const { count } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('org_id', orgId)
    if (count) return true
  }
  return false
}

export async function signLicence({ orgId, deviceId, stationName }) {
  const svc = await serviceDates(orgId)
  return new SignJWT({ svc, dev: deviceId, name: stationName || '' })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(LICENCE_ISSUER)
    .setAudience(LICENCE_AUDIENCE)
    .setSubject(orgId)
    .setIssuedAt()
    .sign(await getSigningKey())
}
