import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'

export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id') || user.org_id

    // Self-heal: if owner has no org_id, find their station and set it
    if (!user.org_id) {
      const { data: ownedOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .single()
      if (ownedOrg) {
        await supabase.from('users').update({ org_id: ownedOrg.id }).eq('id', user.id)
        user.org_id = ownedOrg.id
      }
    }

    // Build subscription query — filter by org_id if provided.
    // Fetch all subscriptions for this user+org so we can pick the best one:
    // approved > pending_approval > pending_payment > expired > rejected.
    // This prevents an expired renewal attempt from hiding a still-active subscription.
    const SUB_COLS = 'id, status, start_date, end_date, created_at, reference_code, payment_deadline, proof_url, plan_type, total_amount, org_id'
    let subQuery = supabase
      .from('subscriptions')
      .select(SUB_COLS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (orgId) {
      subQuery = subQuery.eq('org_id', orgId)
    }

    // Fetch subscription, stations, and global services in parallel
    const [subRes, svcRes, stationsRes] = await Promise.all([
      subQuery,
      supabase
        .from('services')
        .select('id, name, description, price')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('organizations')
        .select('id, name')
        .eq('owner_id', user.id)
        .order('name'),
    ])

    // Pick the most relevant subscription by status priority
    const STATUS_PRIORITY = { approved: 0, pending_approval: 1, pending_payment: 2, expired: 3, rejected: 4 }
    const subs = subRes.data || []
    const bestSub = subs.length > 0
      ? subs.reduce((best, s) => (STATUS_PRIORITY[s.status] ?? 5) < (STATUS_PRIORITY[best.status] ?? 5) ? s : best)
      : null

    return NextResponse.json({
      profile: user,
      subscription: bestSub,
      services: svcRes.data || [],
      stations: stationsRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
