import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { rateLimit } from '@/lib/rateLimit'
import { isAdmin } from '@/lib/stationAccess'

// Maps each entry type to its required service key
const ENTRY_SERVICE_MAP = {
  'daily-sales': 'fuel-operations',
  'product-receipt': 'fuel-operations',
  'lodgements': 'fuel-operations',
  'lube-sales': 'lube-management',
  'lube-stock': 'lube-management',
  'customer-payments': 'customer-payments',
  'imprest': 'fuel-operations',
}

export { ENTRY_SERVICE_MAP }

// Desktop build: every route talks to the local store (lib/local/supabase.js).
export function getServiceClient() {
  return localDb
}

export async function authenticateUser(request) {
  // Desktop build: the signed-in user comes from the local PIN session.
  const { data: { user: authUser } } = await localDb.auth.getUser()
  if (!authUser) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  // Load profile from public.users
  const svc = getServiceClient()
  const { data: profile } = await svc
    .from('users')
    .select('id, email, name, phone, role, org_id')
    .eq('id', authUser.id)
    .single()

  const user = profile
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { success } = rateLimit(`entries:${user.id}`, 200)
  if (!success) return { user: null, error: NextResponse.json({ error: 'Too many requests' }, { status: 429 }) }

  // Get org_id from query param (?org_id=...) — required for all entry operations
  const { searchParams } = new URL(request.url)
  const org_id = searchParams.get('org_id') || user.org_id
  if (!org_id) return { user: null, error: NextResponse.json({ error: 'Station is required' }, { status: 400 }) }

  // Verify user has access: owns station, holds an accepted invite, OR is platform staff.
  //
  // The admin arm is the one lib/stationAccess.js already grants everywhere else, and it was
  // missing here — which meant an admin could run the setup wizard for a station they were
  // onboarding (that route uses hasStationAccess) and then get 403 on every /api/entries/*
  // read for the same station. initialSync throws at its customers check, so the local mirror
  // stayed empty and every entry and report screen came up blank while the setup page, which
  // reads from the server, looked fine. components/AdminViewingBanner.js exists precisely
  // because admins are expected on those screens.
  //
  // The rule is duplicated here rather than delegated to hasStationAccess because that helper
  // resolves the session itself; these routes have already loaded the profile, and the two
  // extra round trips land on the hottest path in the app (initialSync paginates through it).
  // Any change to who may act inside a station belongs in both places.
  const supabase = getServiceClient()
  const { data: station } = await supabase
    .from('organizations')
    .select('id, owner_id')
    .eq('id', org_id)
    .single()

  if (!station) return { user: null, error: NextResponse.json({ error: 'Station not found' }, { status: 404 }) }

  let via = station.owner_id === user.id ? 'owner' : null

  if (!via) {
    const { data: invite } = await supabase
      .from('org_invites')
      .select('id')
      .eq('org_id', org_id)
      .eq('email', user.email)
      .eq('status', 'accepted')
      .single()

    if (invite) via = 'member'
  }

  // Admin last, so `via` always names the most direct relationship: an admin who owns the
  // station is reported as its owner and their writes are not recorded as assists.
  if (!via && isAdmin(user)) via = 'admin'

  if (!via) return { user: null, error: NextResponse.json({ error: 'You do not have access to this station' }, { status: 403 }) }

  // Attach org_id to user for downstream use
  user.org_id = org_id
  // How access was granted, for callers that log admin-on-behalf writes (lib/adminActivity.js).
  user.stationVia = via

  return { user, via, error: null }
}

export async function requireService() {
  // Desktop build: no subscriptions. Every service is available on this machine.
  return { subscribed: true }
}

/**
 * How long after an activity a matching one folds into it instead of adding a row.
 *
 * Two minutes, not seconds. The sync queue drains in a BURST after a spell offline, so a
 * window that expired mid-drain would split one form save back into a row per entry — which
 * is the whole problem. Editing the same entry type twice inside two minutes is one working
 * session anyway.
 */
export const ACTIVITY_FOLD_MS = 2 * 60 * 1000

const VOWELS = ['a', 'e', 'i', 'o', 'u']

/** 'lodgement entry' → 'lodgement entries'. Only the last word changes. */
function pluralize(noun) {
  const words = String(noun).split(' ')
  const last = words.pop()
  words.push(/[^aeiou]y$/i.test(last) ? `${last.slice(0, -1)}ies` : `${last}s`)
  return words.join(' ')
}

/** 'added' + 'lodgement entry' + 5 → 'updated 5 lodgement entries'. */
export function activityPhrase(verb, noun, count) {
  if (count <= 1) {
    const article = VOWELS.includes(String(noun)[0]?.toLowerCase()) ? 'an' : 'a'
    return `${verb} ${article} ${noun}`
  }
  return `${verb} ${count} ${pluralize(noun)}`
}

/**
 * How many rows an existing activity already stands for, or null if it is not the same kind
 * and must not be folded into.
 *
 * Reads the count back out of the sentence rather than off a column, so this needed no
 * migration. That is safe only because the sentence is one we wrote ourselves, in exactly the
 * shape activityPhrase produces — free text from the other callers falls through to null.
 */
export function parseActivityCount(content, verb, noun) {
  if (typeof content !== 'string') return null
  const singular = new RegExp(`^${verb} an? ${noun}$`)
  if (singular.test(content)) return 1
  const plural = new RegExp(`^${verb} (\\d+) ${pluralize(noun)}$`)
  const m = content.match(plural)
  return m ? Number(m[1]) : null
}

/**
 * Log an activity event to the station_messages table.
 * Fire-and-forget — never throws.
 *
 * Two shapes of caller:
 *
 *   `content` — a finished sentence for a one-off event ("created imprest period"). Written
 *   through untouched, and never folded: two of those really are two things that happened.
 *
 *   `verb` + `noun` — an entry write. These arrive one per ROW, because the forms queue a sync
 *   op per row and lib/sync.js pushes them one at a time, so a five-row day used to post five
 *   identical notifications and inflate the unread count fivefold. A matching activity inside
 *   ACTIVITY_FOLD_MS is rewritten with the new count instead.
 *
 * Matching is deliberately strict: same station, same person, same action type, same verb AND
 * the same noun. A different entry type, a different person, or an add against an edit are all
 * separate events and stay apart.
 */
export async function logActivity(supabase, { orgId, userId, userName, content, actionType, verb, noun }) {
  try {
    const table = supabase.from('station_messages')

    if (verb && noun) {
      const since = new Date(Date.now() - ACTIVITY_FOLD_MS).toISOString()
      const { data: recent } = await supabase
        .from('station_messages')
        .select('id, content')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .eq('action_type', actionType)
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(1)

      const prior = (recent || [])[0]
      const seen = prior ? parseActivityCount(prior.content, verb, noun) : null
      if (seen != null) {
        const { error } = await supabase
          .from('station_messages')
          .update({ content: activityPhrase(verb, noun, seen + 1) })
          .eq('id', prior.id)
        if (error) console.error('logActivity fold failed:', error.message)
        return
      }
      content = activityPhrase(verb, noun, 1)
    }

    const { error } = await table.insert({
      org_id: orgId,
      user_id: userId,
      user_name: userName || 'Unknown',
      type: 'activity',
      content,
      action_type: actionType,
    })
    if (error) console.error('logActivity insert failed:', error.message)
  } catch (err) {
    console.error('logActivity exception:', err)
  }
}

export function paginationParams(request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const from = (page - 1) * limit
  const to = from + limit - 1
  return { page, limit, from, to, searchParams }
}
