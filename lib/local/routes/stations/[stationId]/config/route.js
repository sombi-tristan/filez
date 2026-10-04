import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess } from '@/lib/stationAccess'

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stationId } = await params
    const supabase = getAdminClient()

    // Owner, accepted staff, or platform admin. This is a read, so nothing is logged:
    // recording GETs would bury real actions under page views.
    const { ok } = await hasStationAccess(user, stationId)
    if (!ok) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    const { data: station } = await supabase
      .from('organizations')
      .select('id, name, location')
      .eq('id', stationId)
      .maybeSingle()

    const [nozzlesRes, tanksRes, banksRes, lubeRes, customersRes] = await Promise.all([
      supabase
        .from('station_pumps')
        .select('id, fuel_type, pump_number, initial_reading, tank_id, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_tanks')
        .select('id, fuel_type, tank_number, capacity, opening_stock, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_banks')
        .select('id, bank_name, lodgement_type, terminal_id, opening_balance, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_lube_products')
        .select('id, product_name, unit_price, opening_stock, opening_date')
        .eq('org_id', stationId)
        .order('sort_order'),
      supabase
        .from('station_customers')
        .select('id, name, phone, opening_balance, opening_date, station_value_tracked')
        .eq('org_id', stationId)
        .order('sort_order'),
    ])

    return NextResponse.json({
      station,
      nozzles: nozzlesRes.data || [],
      tanks: tanksRes.data || [],
      lodgements: banksRes.data || [],
      lube_products: lubeRes.data || [],
      customers: customersRes.data || [],
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
