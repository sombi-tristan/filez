import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess, canAdministerStation } from '@/lib/stationAccess'

// GET — user checks their pending invites
export async function GET(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: invites } = await supabase
      .from('org_invites')
      .select('id, org_id, status, invited_at, organizations(id, name)')
      .eq('email', user.email)
      .eq('status', 'pending')
      .order('invited_at', { ascending: false })

    // Also fetch accepted invite for a specific station (for page permissions)
    const { searchParams } = new URL(request.url)
    const org_id = searchParams.get('org_id') || user.org_id
    let visiblePages = null
    if (org_id) {
      const { data: membership } = await supabase
        .from('org_invites')
        .select('visible_pages')
        .eq('email', user.email)
        .eq('org_id', org_id)
        .eq('status', 'accepted')
        .single()
      visiblePages = membership?.visible_pages ?? [
        'daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments',
        'report-summary', 'report-daily-sales', 'report-sales-operation', 'report-audit',
        'report-audit-sales-cash', 'report-audit-lodgement-sheet', 'report-audit-stock-position',
        'report-audit-stock-summary', 'report-audit-consumption', 'report-audit-calculator',
        'report-audit-product-received',
        'report-account-ledger', 'report-product-received', 'report-lube',
        'imprest',
      ]
    }

    return NextResponse.json({ invites: invites || [], visiblePages })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — owner adds a staff member by the email of their StationMGR web account.
//
// Desktop build: an accepted org_invites row, exactly the shape an accepted online invite has;
// the person signs in on this computer with that web account (lib/local/accounts.js), and the
// invite is what lets them open the station. No account or password is made here.
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, email } = await request.json()
    const address = String(email || '').trim().toLowerCase()
    if (!org_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return NextResponse.json({ error: 'Enter their email address' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { ok, via } = await hasStationAccess(user, org_id)
    if (!ok || !canAdministerStation(via)) {
      return NextResponse.json({ error: 'Only the owner can add staff' }, { status: 403 })
    }

    const { data: already } = await supabase.from('org_invites').select('id').eq('org_id', org_id).eq('email', address).maybeSingle()
    if (already) return NextResponse.json({ error: 'That person is already staff here' }, { status: 409 })

    const now = new Date().toISOString()
    const { data: invite, error } = await supabase
      .from('org_invites')
      .insert({ org_id, email: address, status: 'accepted', invited_at: now, responded_at: now })
      .select('id, email, status, invited_at, visible_pages')
      .single()
    if (error) return NextResponse.json({ error: 'Failed to add staff' }, { status: 500 })

    const { data: person } = await supabase.from('users').select('name').eq('email', address).maybeSingle()
    return NextResponse.json({ invite: { ...invite, name: person?.name || address } })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE — owner removes a staff member: their access and their sign-in.
export async function DELETE(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Invite id required' }, { status: 400 })

    const supabase = getAdminClient()
    const { data: invite } = await supabase.from('org_invites').select('id, org_id, email').eq('id', id).single()
    if (!invite) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

    const { ok, via } = await hasStationAccess(user, invite.org_id)
    if (!ok || !canAdministerStation(via)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Their web account stays (it may open other stations); the invite is what opened this one.
    await supabase.from('org_invites').delete().eq('id', id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
