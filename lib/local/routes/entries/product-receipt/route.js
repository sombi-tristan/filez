import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient, paginationParams, requireService, logActivity } from '@/lib/entryHelpers'

const TABLE = 'product_receipt_entries'
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
      const { data } = await supabase.from(TABLE).select('*, users:created_by(name), tank:tank_id(id, fuel_type, tank_number)').eq('id', id).eq('org_id', user.org_id).is('deleted_at', null).single()
      return NextResponse.json({ entry: data })
    }

    const { data, count } = await supabase
      .from(TABLE)
      .select('*, users:created_by(name), tank:tank_id(id, fuel_type, tank_number)', { count: 'exact' })
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

    const body = await request.json()
    if (!body.entry_date) {
      return NextResponse.json({ error: 'Date is required' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        ...(body.id ? { id: body.id } : {}),
        org_id: user.org_id,
        entry_date: body.entry_date,
        loaded_date: body.loaded_date || null,
        driver_name: body.driver_name?.trim() || null,
        waybill_number: body.waybill_number?.trim() || null,
        ticket_number: body.ticket_number?.trim() || null,
        truck_number: body.truck_number?.trim() || null,
        chart_ullage: Number(body.chart_ullage) || 0,
        chart_liquid_height: Number(body.chart_liquid_height) || 0,
        depot_ullage: Number(body.depot_ullage) || 0,
        depot_liquid_height: Number(body.depot_liquid_height) || 0,
        station_ullage: Number(body.station_ullage) || 0,
        station_liquid_height: Number(body.station_liquid_height) || 0,
        first_compartment: Number(body.first_compartment) || 0,
        second_compartment: Number(body.second_compartment) || 0,
        third_compartment: Number(body.third_compartment) || 0,
        actual_volume: Number(body.actual_volume) || 0,
        chart_high_ullage_1: Number(body.chart_high_ullage_1) || 0,
        chart_high_ullage_2: Number(body.chart_high_ullage_2) || 0,
        chart_high_ullage_3: Number(body.chart_high_ullage_3) || 0,
        chart_low_ullage_1: Number(body.chart_low_ullage_1) || 0,
        chart_low_ullage_2: Number(body.chart_low_ullage_2) || 0,
        chart_low_ullage_3: Number(body.chart_low_ullage_3) || 0,
        chart_liquid_height_1: Number(body.chart_liquid_height_1) || 0,
        chart_liquid_height_2: Number(body.chart_liquid_height_2) || 0,
        chart_liquid_height_3: Number(body.chart_liquid_height_3) || 0,
        depot_ullage_1: Number(body.depot_ullage_1) || 0,
        depot_ullage_2: Number(body.depot_ullage_2) || 0,
        depot_ullage_3: Number(body.depot_ullage_3) || 0,
        depot_liquid_height_1: Number(body.depot_liquid_height_1) || 0,
        depot_liquid_height_2: Number(body.depot_liquid_height_2) || 0,
        depot_liquid_height_3: Number(body.depot_liquid_height_3) || 0,
        station_ullage_1: Number(body.station_ullage_1) || 0,
        station_ullage_2: Number(body.station_ullage_2) || 0,
        station_ullage_3: Number(body.station_ullage_3) || 0,
        station_liquid_height_1: Number(body.station_liquid_height_1) || 0,
        station_liquid_height_2: Number(body.station_liquid_height_2) || 0,
        station_liquid_height_3: Number(body.station_liquid_height_3) || 0,
        high_vol_1: Number(body.high_vol_1) || 0,
        high_vol_2: Number(body.high_vol_2) || 0,
        high_vol_3: Number(body.high_vol_3) || 0,
        low_vol_1: Number(body.low_vol_1) || 0,
        low_vol_2: Number(body.low_vol_2) || 0,
        low_vol_3: Number(body.low_vol_3) || 0,
        depot_name: body.depot_name?.trim() || null,
        tank_id: body.tank_id || null,
        arrival_time: body.arrival_time?.trim() || null,
        exit_time: body.exit_time?.trim() || null,
        notes: body.notes?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'added', noun: 'product receipt entry', actionType: 'created_entry' })
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

    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Entry id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    const fields = [
      'entry_date', 'loaded_date', 'driver_name', 'waybill_number', 'ticket_number',
      'truck_number', 'depot_name', 'arrival_time', 'exit_time', 'notes',
    ]
    const numericFields = [
      'chart_ullage', 'chart_liquid_height', 'depot_ullage', 'depot_liquid_height',
      'station_ullage', 'station_liquid_height', 'first_compartment', 'second_compartment',
      'third_compartment', 'actual_volume',
      'chart_high_ullage_1', 'chart_high_ullage_2', 'chart_high_ullage_3',
      'chart_low_ullage_1', 'chart_low_ullage_2', 'chart_low_ullage_3',
      'chart_liquid_height_1', 'chart_liquid_height_2', 'chart_liquid_height_3',
      'depot_ullage_1', 'depot_ullage_2', 'depot_ullage_3',
      'depot_liquid_height_1', 'depot_liquid_height_2', 'depot_liquid_height_3',
      'station_ullage_1', 'station_ullage_2', 'station_ullage_3',
      'station_liquid_height_1', 'station_liquid_height_2', 'station_liquid_height_3',
      'high_vol_1', 'high_vol_2', 'high_vol_3',
      'low_vol_1', 'low_vol_2', 'low_vol_3',
    ]

    fields.forEach((f) => { if (body[f] !== undefined) updates[f] = body[f]?.trim?.() || body[f] || null })
    numericFields.forEach((f) => { if (body[f] !== undefined) updates[f] = Number(body[f]) || 0 })
    if (body.tank_id !== undefined) updates.tank_id = body.tank_id || null

    const supabase = getServiceClient()
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .update(updates)
      .eq('id', body.id)
      .eq('org_id', user.org_id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    await logActivity(supabase, { orgId: user.org_id, userId: user.id, userName: user.name || user.email, verb: 'updated', noun: 'product receipt entry', actionType: 'updated_entry' })
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
