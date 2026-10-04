import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess, canAdministerStation } from '@/lib/stationAccess'
import { hashPin } from '@/lib/local/pin'

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

// POST — owner adds a staff member who signs in on this computer with a PIN.
//
// Desktop build: there is no email and no sign-up, so "inviting" creates the person outright:
// a users row (username in `email`, which is what the rest of the app keys staff on) and an
// accepted org_invites row carrying their page permissions, exactly the shape an accepted
// online invite had.
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { org_id, name, username, pin } = await request.json()
    const login = String(username || '').trim().toLowerCase()

    if (!org_id || !login || !name?.trim()) {
      return NextResponse.json({ error: 'Name and username are required' }, { status: 400 })
    }
    if (!/^[a-z0-9._-]{2,32}$/.test(login)) {
      return NextResponse.json({ error: 'Username: 2-32 letters, numbers, dots, dashes or underscores' }, { status: 400 })
    }
    if (!/^\d{4,8}$/.test(String(pin || ''))) {
      return NextResponse.json({ error: 'PIN must be 4 to 8 digits' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { ok, via } = await hasStationAccess(user, org_id)
    if (!ok || !canAdministerStation(via)) {
      return NextResponse.json({ error: 'Only the owner can add staff' }, { status: 403 })
    }

    const { data: taken } = await supabase.from('users').select('id').eq('email', login).maybeSingle()
    if (taken) return NextResponse.json({ error: 'That username is already in use' }, { status: 409 })

    const { data: staff, error: userErr } = await supabase
      .from('users')
      .insert({ email: login, name: name.trim(), role: 'user', org_id, pin_hash: await hashPin(pin) })
      .select('id')
      .single()
    if (userErr) return NextResponse.json({ error: 'Failed to add staff' }, { status: 500 })

    const { data: invite, error } = await supabase
      .from('org_invites')
      .insert({ org_id, email: login, status: 'accepted', invited_at: new Date().toISOString(), responded_at: new Date().toISOString() })
      .select('id, email, status, invited_at, visible_pages')
      .single()
    if (error) {
      await supabase.from('users').delete().eq('id', staff.id)
      return NextResponse.json({ error: 'Failed to add staff' }, { status: 500 })
    }

    return NextResponse.json({ invite: { ...invite, name: name.trim() } })
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

    await supabase.from('org_invites').delete().eq('id', id)
    // Their past entries keep pointing at the users row (created_by), so the person stays on
    // record; removing the PIN is what takes away the sign-in.
    await supabase.from('users').update({ pin_hash: null, disabled: true }).eq('email', invite.email).neq('id', user.id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
