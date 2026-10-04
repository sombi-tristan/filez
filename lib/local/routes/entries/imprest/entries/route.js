import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient, paginationParams, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'imprest_entries'
const SERVICE_KEY = 'fuel-operations'

// GET — list entries for a period
export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { from, to, page, limit, searchParams } = paginationParams(request)
    const supabase = getServiceClient()

    const periodId = searchParams.get('period_id')
    if (!periodId) return NextResponse.json({ error: 'period_id is required' }, { status: 400 })

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name)', { count: 'exact' })
      .eq('org_id', user.org_id)
      .eq('imprest_period_id', periodId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: true })
      .range(from, to)

    return NextResponse.json({ entries: data || [], total: count || 0, page, limit })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — create or update an entry
export async function POST(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error
    const { subscribed, error: subError } = await requireService(user, SERVICE_KEY)
    if (!subscribed) return subError

    const body = await request.json()
    if (!body.imprest_period_id) return NextResponse.json({ error: 'Period is required' }, { status: 400 })
    if (!body.entry_date) return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    if (!body.beneficiary?.trim()) return NextResponse.json({ error: 'Beneficiary is required' }, { status: 400 })

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        ...(body.id ? { id: body.id } : {}),
        org_id: user.org_id,
        imprest_period_id: body.imprest_period_id,
        entry_date: body.entry_date,
        beneficiary: body.beneficiary.trim(),
        transaction_details: body.transaction_details?.trim() || null,
        amount: Number(body.amount) || 0,
        account_code: body.account_code?.trim() || null,
        pcv_number: body.pcv_number?.trim() || null,
        receipt_image_url: body.receipt_image_url || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 })

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'added', noun: 'imprest entry', actionType: 'created_entry' })
    return NextResponse.json({ entry: data })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
