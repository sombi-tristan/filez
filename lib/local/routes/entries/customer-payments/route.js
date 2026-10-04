import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient, paginationParams, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'customer_payment_entries'
const SERVICE_KEY = 'customer-payments'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { from, to, page, limit, searchParams } = paginationParams(request)
    const supabase = getServiceClient()

    // Single entry by ID
    const id = searchParams.get('id')
    if (id) {
      const { data } = await supabase.from(TABLE).select('*, users:created_by(name), customer:customer_id(id, name, phone)').eq('id', id).eq('org_id', user.org_id).is('deleted_at', null).single()
      return NextResponse.json({ entry: data })
    }

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name), customer:customer_id(id, name, phone)', { count: 'exact' })
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

    const { id, entry_date, customer_id, amount_paid, sales_amount, notes } = await request.json()

    if (!entry_date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    if (!customer_id) return NextResponse.json({ error: 'Customer is required' }, { status: 400 })

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        ...(id ? { id } : {}),
        org_id: user.org_id,
        entry_date,
        customer_id,
        amount_paid: Number(amount_paid) || 0,
        sales_amount: Number(sales_amount) || 0,
        notes: notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'added', noun: 'customer payment entry', actionType: 'created_entry' })
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

    const { id, entry_date, customer_id, amount_paid, sales_amount, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    if (entry_date) updates.entry_date = entry_date
    if (customer_id !== undefined) updates.customer_id = customer_id
    if (amount_paid !== undefined) updates.amount_paid = Number(amount_paid) || 0
    if (sales_amount !== undefined) updates.sales_amount = Number(sales_amount) || 0
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

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'updated', noun: 'customer payment entry', actionType: 'updated_entry' })
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
