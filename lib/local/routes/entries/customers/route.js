import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient } from '@/lib/entryHelpers'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from('station_customers')
      .select('id, name, phone, opening_balance, opening_date, sort_order, station_value_tracked')
      .eq('org_id', user.org_id)
      .order('sort_order')

    if (dbError) {
      return NextResponse.json({ error: `Customers query failed: ${dbError.message}` }, { status: 500 })
    }

    return NextResponse.json({ customers: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name || name.length > 200) {
      return NextResponse.json({ error: 'Name is required (max 200 chars)' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { count } = await supabase
      .from('station_customers')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.org_id)

    const { data, error: dbError } = await supabase
      .from('station_customers')
      .insert({
        org_id: user.org_id,
        name,
        phone: body.phone ? String(body.phone).trim().slice(0, 20) : null,
        opening_balance: Number(body.opening_balance) || 0,
        opening_date: body.opening_date || new Date().toISOString().split('T')[0],
        sort_order: count || 0,
        station_value_tracked: Boolean(body.station_value_tracked),
      })
      .select('id, name, phone, opening_balance, opening_date, sort_order, station_value_tracked')
      .single()

    if (dbError) {
      console.error('Customer create error:', dbError)
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    return NextResponse.json({ customer: data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const body = await request.json()
    const { id } = body
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const updates = {}
    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (!name || name.length > 200) return NextResponse.json({ error: 'Name is required (max 200 chars)' }, { status: 400 })
      updates.name = name
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone ? String(body.phone).trim().slice(0, 20) : null
    }
    if (body.opening_balance !== undefined) {
      updates.opening_balance = Number(body.opening_balance) || 0
    }
    if (body.opening_date !== undefined) {
      updates.opening_date = body.opening_date
    }
    if (body.station_value_tracked !== undefined) {
      updates.station_value_tracked = Boolean(body.station_value_tracked)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from('station_customers')
      .update(updates)
      .eq('id', id)
      .eq('org_id', user.org_id)
      .select('id, name, phone, opening_balance, opening_date, sort_order, station_value_tracked')
      .single()

    if (dbError || !data) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json({ customer: data })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const supabase = getServiceClient()

    const { data: customer } = await supabase
      .from('station_customers')
      .select('id, phone')
      .eq('id', id)
      .eq('org_id', user.org_id)
      .single()

    if (!customer) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    if (customer.phone === 'DEFAULT') {
      return NextResponse.json({ error: 'Cannot delete default accounts' }, { status: 400 })
    }

    const { error: dbError } = await supabase
      .from('station_customers')
      .delete()
      .eq('id', id)
      .eq('org_id', user.org_id)

    if (dbError) {
      console.error('Customer delete error:', dbError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
