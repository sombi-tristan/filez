import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient } from '@/lib/entryHelpers'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const supabase = getServiceClient()
    const { data } = await supabase
      .from('station_tanks')
      .select('id, fuel_type, tank_number, capacity, opening_stock')
      .eq('org_id', user.org_id)
      .order('sort_order')

    return NextResponse.json({ tanks: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
