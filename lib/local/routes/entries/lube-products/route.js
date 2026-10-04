import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient } from '@/lib/entryHelpers'

export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const supabase = getServiceClient()
    const { data } = await supabase
      .from('station_lube_products')
      .select('id, product_name, unit_price, opening_stock, opening_date')
      .eq('org_id', user.org_id)
      .order('sort_order')

    return NextResponse.json({ products: data || [] })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
