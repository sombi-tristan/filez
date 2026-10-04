import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient, paginationParams, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'lube_sales_entries'
const SERVICE_KEY = 'lube-management'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { from, to, page, limit, searchParams } = paginationParams(request)
    const supabase = getServiceClient()

    // Single entry by ID
    const id = searchParams.get('id')
    if (id) {
      const { data } = await supabase.from(TABLE).select('*, users:created_by(name), product:product_id(id, product_name)').eq('id', id).eq('org_id', user.org_id).is('deleted_at', null).single()
      return NextResponse.json({ entry: data })
    }

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name), product:product_id(id, product_name)', { count: 'exact' })
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .order('entry_date', { ascending: false })
      .range(from, to)

    return NextResponse.json({ entries: data || [], total: count || 0, page, limit })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id, entry_date, product_id, unit_sold, unit_received, price, notes } = await request.json()

    if (!entry_date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    if (!product_id) return NextResponse.json({ error: 'Product is required' }, { status: 400 })

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        ...(id ? { id } : {}),
        org_id: user.org_id,
        entry_date,
        product_id,
        unit_sold: Number(unit_sold) || 0,
        unit_received: Number(unit_received) || 0,
        price: Number(price) || 0,
        notes: notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'added', noun: 'lube sales entry', actionType: 'created_entry' })
    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id, entry_date, product_id, unit_sold, unit_received, price, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    if (entry_date) updates.entry_date = entry_date
    if (product_id !== undefined) updates.product_id = product_id
    if (unit_sold !== undefined) updates.unit_sold = Number(unit_sold) || 0
    if (unit_received !== undefined) updates.unit_received = Number(unit_received) || 0
    if (price !== undefined) updates.price = Number(price) || 0
    if (notes !== undefined) updates.notes = notes?.trim() || null

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .eq('org_id', user.org_id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'updated', noun: 'lube sales entry', actionType: 'updated_entry' })
    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const supabase = getServiceClient()
    const now = new Date().toISOString()
    await supabase.from(TABLE).update({ deleted_at: now, updated_at: now }).eq('id', id).eq('org_id', user.org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
