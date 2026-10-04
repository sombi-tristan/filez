import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess, canAdministerStation } from '@/lib/stationAccess'
import { logStationAssist } from '@/lib/adminActivity'

const VALID_PAGES = [
  'daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments',
  'report-summary', 'report-daily-sales', 'report-sales-operation', 'report-sales-overview', 'report-inventory-log', 'report-analytics', 'report-audit', 'report-account-ledger', 'report-product-received',
  'report-audit-sales-cash', 'report-audit-lodgement-sheet', 'report-audit-stock-position',
  'report-audit-stock-summary', 'report-audit-consumption', 'report-audit-calculator',
  'report-audit-product-received',
  'report-lube',
  'imprest',
]

// PATCH — manager updates visible_pages for a staff invite
export async function PATCH(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { invite_id, visible_pages } = await request.json()
    if (!invite_id || !Array.isArray(visible_pages)) {
      return NextResponse.json({ error: 'invite_id and visible_pages array required' }, { status: 400 })
    }

    // Only allow known page keys
    const filtered = visible_pages.filter((p) => VALID_PAGES.includes(p))

    const supabase = getAdminClient()

    // Verify the invite belongs to a station this user owns
    const { data: invite } = await supabase
      .from('org_invites')
      .select('id, org_id')
      .eq('id', invite_id)
      .single()

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Owner or platform admin. Emphatically NOT ordinary staff: this route sets which pages
    // a member may see, so letting a member reach it would let them widen their own access.
    const { ok, via } = await hasStationAccess(user, invite.org_id)
    if (!ok || !canAdministerStation(via)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('org_invites')
      .update({ visible_pages: filtered })
      .eq('id', invite_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 })
    }

    await logStationAssist({
      user, via, orgId: invite.org_id, request,
      actionType: 'permissions_changed',
      content: 'changed a staff member\'s page permissions on their behalf',
    })

    return NextResponse.json({ ok: true, visible_pages: filtered })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
