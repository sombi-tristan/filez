import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'imprest_periods'
const SERVICE_KEY = 'fuel-operations'

// GET — list periods or single period by id
export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const supabase = getServiceClient()

    // Single period by id
    const id = searchParams.get('id')
    if (id) {
      const { data } = await supabase.from(TABLE).select('*').eq('id', id).eq('org_id', user.org_id).single()
      return NextResponse.json({ period: data })
    }

    // Period by month + year
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    if (month && year) {
      const { data } = await supabase
        .from(TABLE)
        .select('*')
        .eq('org_id', user.org_id)
        .eq('month', Number(month))
        .eq('year', Number(year))
        .single()
      return NextResponse.json({ period: data })
    }

    // All periods for this org
    const { data } = await supabase
      .from(TABLE)
      .select('*')
      .eq('org_id', user.org_id)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    return NextResponse.json({ periods: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create or update a period (upsert by org_id + month + year)
export async function POST(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const body = await request.json()
    if (!body.month || !body.year) {
      return NextResponse.json({ error: 'Month and year are required' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Check if period exists
    const { data: existing } = await supabase
      .from(TABLE)
      .select('id')
      .eq('org_id', user.org_id)
      .eq('month', Number(body.month))
      .eq('year', Number(body.year))
      .single()

    const row = {
      org_id: user.org_id,
      month: Number(body.month),
      year: Number(body.year),
      imprest_amount: Number(body.imprest_amount) || 0,
      custodian_name: body.custodian_name?.trim() || null,
      form_number: body.form_number?.trim() || null,
      notes: body.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    }

    let data
    if (existing) {
      const { data: updated, error: dbError } = await supabase
        .from(TABLE)
        .update(row)
        .eq('id', existing.id)
        .select()
        .single()
      if (dbError) return NextResponse.json({ error: 'Failed to update period' }, { status: 500 })
      data = updated
    } else {
      row.created_by = user.id
      const { data: created, error: dbError } = await supabase
        .from(TABLE)
        .insert(row)
        .select()
        .single()
      if (dbError) return NextResponse.json({ error: 'Failed to create period' }, { status: 500 })
      data = created
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, content: `${existing ? 'updated' : 'created'} imprest period`, actionType: 'imprest_period' })
    return NextResponse.json({ period: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
