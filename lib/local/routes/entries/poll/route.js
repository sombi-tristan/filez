import { NextResponse } from '@/lib/local/nextServer'
import { authenticateUser, getServiceClient } from '@/lib/entryHelpers'

const TABLES = [
  { server: 'daily_sales_entries',      key: 'dailySales' },
  { server: 'product_receipt_entries',   key: 'productReceipts' },
  { server: 'lodgement_entries',         key: 'lodgements' },
  { server: 'lube_sales_entries',        key: 'lubeSales' },
  { server: 'lube_stock_entries',        key: 'lubeStock' },
  { server: 'customer_payment_entries',  key: 'customerPayments' },
]

/**
 * GET /api/entries/poll?org_id=...&since=ISO_TIMESTAMP
 *
 * Returns entries updated after `since` across all entry tables.
 * Lightweight: one query per table, only returns changed rows.
 */
export async function GET(request) {
  try {
    const { user, error } = await authenticateUser(request)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')
    if (!since) return NextResponse.json({ error: 'since parameter required' }, { status: 400 })

    const supabase = getServiceClient()
    const result = {}

    await Promise.all(TABLES.map(async ({ server, key }) => {
      // Include soft-deleted records so clients can propagate deletions
      const { data } = await supabase
        .from(server)
        .select('*')
        .eq('org_id', user.org_id)
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .limit(200)

      if (data?.length) result[key] = data
    }))

    return NextResponse.json({ changes: result, polledAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
