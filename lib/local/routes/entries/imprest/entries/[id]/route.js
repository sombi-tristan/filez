import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'imprest_entries'
const SERVICE_KEY = 'fuel-operations'

// PATCH — update an entry
export async function PATCH(request, { params }) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id } = await params
    const body = await request.json()

    const updates = { updated_at: new Date().toISOString() }
    const fields = ['entry_date', 'beneficiary', 'transaction_details', 'account_code', 'pcv_number', 'receipt_image_url']
    fields.forEach((f) => { if (body[f] !== undefined) updates[f] = typeof body[f] === 'string' ? body[f].trim() || null : body[f] })
    if (body.amount !== undefined) updates.amount = Number(body.amount) || 0

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', id)
      .eq('org_id', user.org_id)
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'updated', noun: 'imprest entry', actionType: 'updated_entry' })
    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — soft delete an entry
export async function DELETE(request, { params }) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const { id } = await params
    const supabase = getServiceClient()
    const now = new Date().toISOString()
    await supabase.from(TABLE).update({ deleted_at: now, updated_at: now }).eq('id', id).eq('org_id', user.org_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
