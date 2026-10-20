import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { logAdminActivity } from '@/lib/adminActivity'

/**
 * Grant a station a subscription outright, without payment. Modelled on wacart's `grant_pro`
 * (wacart/app/api/admin/sellers/[id]/route.js), adapted to a schema that bills per service
 * rather than by plan.
 *
 * Three things differ from wacart's version, and each one is load-bearing:
 *
 * 1. It writes subscription_items, one per active service. wacart has a single `plan_type`
 *    to flip; here /api/subscription-check gates every feature by looking for an item whose
 *    service_id matches, so a subscription with no items is "approved" and unlocks nothing.
 *
 * 2. user_id is the STATION OWNER, never the admin doing the granting. That same check joins
 *    on `subscriptions.user_id = organizations.owner_id`, so a row stamped with the admin's
 *    id would sit in the table looking correct and gate nothing.
 *
 * 3. Duration is in months, not wacart's days. end_date is month arithmetic throughout this
 *    schema, and the `months` column is what the approve path reads.
 *
 * The grant is recorded in station_messages, the station's activity record. Its Notifications
 * screen, which showed this to the owner, is gone, so nothing shows the row now.
 */
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { org_id, months } = await request.json()
    const duration = Number(months)
    if (!org_id) return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    if (!Number.isInteger(duration) || duration < 1 || duration > 24) {
      return NextResponse.json({ error: 'Months must be a whole number from 1 to 24' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, owner_id')
      .eq('id', org_id)
      .maybeSingle()
    if (!org) return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    if (!org.owner_id) {
      return NextResponse.json({ error: 'That station has no owner to grant to' }, { status: 400 })
    }

    // Every active service, because this grants the lot. An empty list would produce an
    // approved subscription that opens nothing, so it is an error rather than a silent no-op.
    const { data: services } = await supabase
      .from('services')
      .select('id, name, price')
      .eq('is_active', true)
    if (!services || services.length === 0) {
      return NextResponse.json({ error: 'There are no active services to grant' }, { status: 400 })
    }

    const today = new Date()
    const endDate = new Date(today)
    endDate.setMonth(endDate.getMonth() + duration)

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: org.owner_id,
        org_id,
        status: 'approved',
        plan_type: 'recurring',
        months: duration,
        total_amount: 0,
        start_date: today.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        notes: `Granted by ${user.name || user.email} for ${duration} month${duration > 1 ? 's' : ''}`,
      })
      .select('id, end_date')
      .single()

    if (subError || !sub) {
      return NextResponse.json({ error: 'Failed to create the subscription' }, { status: 500 })
    }

    const { error: itemsError } = await supabase.from('subscription_items').insert(
      services.map((s) => ({
        subscription_id: sub.id,
        service_id: s.id,
        service_name: s.name,
        price: 0,
      }))
    )

    // Roll back rather than leave an approved subscription that gates nothing. That row would
    // read as active on every screen while every feature stayed locked, which is worse than
    // the grant plainly failing.
    if (itemsError) {
      await supabase.from('subscriptions').delete().eq('id', sub.id)
      return NextResponse.json({ error: 'Failed to grant the services' }, { status: 500 })
    }

    // Best effort from here. The grant itself is done, and failing the request now would
    // invite the admin to grant a second one.
    // type 'message', not a new 'system' value. That is the only type anything in this app
    // writes, the notifications screen does not branch on it, and the column's accepted values
    // are not pinned down in any migration here. The admin's name is already on the row, and
    // the wording says who it came from.
    await supabase.from('station_messages').insert({
      org_id,
      user_id: user.id,
      user_name: user.name || user.email,
      type: 'message',
      content: `Subscription granted by the Premeval team for ${duration} month${duration > 1 ? 's' : ''}, covering every service. Active until ${sub.end_date}.`,
    }).then(null, () => {})

    await logAdminActivity(user, `Granted a ${duration}-month subscription to ${org.name}`, {
      orgId: org_id,
      orgName: org.name,
      actionType: 'subscription_granted',
      targetType: 'subscription',
      targetId: sub.id,
      details: { months: duration, services: services.length, end_date: sub.end_date },
    })

    return NextResponse.json({
      ok: true,
      subscription: sub,
      message: `Granted ${duration} month${duration > 1 ? 's' : ''} to ${org.name}, covering ${services.length} service${services.length > 1 ? 's' : ''}.`,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
