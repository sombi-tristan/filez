import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient, paginationParams, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'lodgement_entries'
const SERVICE_KEY = 'fuel-operations'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { from, to, page, limit, searchParams } = paginationParams(request)
    const supabase = getServiceClient()

    // Single entry by ID
    const id = searchParams.get('id')
    if (id) {
      const { data } = await supabase.from(TABLE).select('*, users:created_by(name), bank:bank_id(id, bank_name, lodgement_type)').eq('id', id).eq('org_id', user.org_id).is('deleted_at', null).single()
      return NextResponse.json({ entry: data })
    }

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name), bank:bank_id(id, bank_name, lodgement_type)', { count: 'exact' })
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

    const { id, entry_date, amount, bank_id, lodgement_type, sales_date, notes } = await request.json()

    if (!entry_date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    if (!bank_id) return NextResponse.json({ error: 'Bank account is required' }, { status: 400 })
    if (!['deposit', 'lube-deposit', 'pos', 'transfer'].includes(lodgement_type)) {
      return NextResponse.json({ error: 'Invalid lodgement type' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        ...(id ? { id } : {}),
        org_id: user.org_id,
        entry_date,
        amount: Number(amount) || 0,
        bank_id,
        lodgement_type,
        sales_date: sales_date || null,
        notes: notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'added', noun: 'lodgement entry', actionType: 'created_entry' })
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

    const { id, entry_date, amount, bank_id, lodgement_type, sales_date, notes } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    if (entry_date) updates.entry_date = entry_date
    if (amount !== undefined) updates.amount = Number(amount) || 0
    if (bank_id !== undefined) updates.bank_id = bank_id
    if (lodgement_type !== undefined) {
      if (!['deposit', 'lube-deposit', 'pos', 'transfer'].includes(lodgement_type)) {
        return NextResponse.json({ error: 'Invalid lodgement type' }, { status: 400 })
      }
      updates.lodgement_type = lodgement_type
    }
    if (sales_date !== undefined) updates.sales_date = sales_date || null
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

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'updated', noun: 'lodgement entry', actionType: 'updated_entry' })
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
