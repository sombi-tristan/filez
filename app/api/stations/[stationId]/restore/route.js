import { NextResponse } from 'next/server'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { anyServiceRunning } from '@/lib/desktop'
import { logActivity } from '@/lib/entryHelpers'
import { restoreIntoStation } from '@/lib/webRestore'

/**
 * Restore from backup, from the station's Settings: a StationMGR Desktop backup file into this
 * web station (lib/webRestore.js).
 *
 *   POST { backup, preview: true }   what differs, for the warning: { summary }
 *   POST { backup, mode }            'overwrite' or 'pad': { ok, counts }
 *
 * Only the station's owner, only with a subscription running, as on the desktop. Never while a
 * StationMGR Desktop computer is linked to the station (409): the computer is its source of truth,
 * and its next push would bring back what the restore replaced. The owner restores there, or
 * revokes the computer under Linked computers first.
 */
export async function POST(request, { params }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { stationId } = await params
    const supabase = getAdminClient()

    const { data: station } = await supabase.from('organizations').select('id, owner_id').eq('id', stationId).maybeSingle()
    if (!station) return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    if (station.owner_id !== user.id) return NextResponse.json({ error: 'Only the station\'s owner can restore a backup into it' }, { status: 403 })

    if (!(await anyServiceRunning(stationId))) {
      return NextResponse.json({ error: 'Restoring a backup needs a subscription running on this station' }, { status: 403 })
    }

    const { count: linked } = await supabase
      .from('desktop_devices')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', stationId)
      .is('revoked_at', null)
    if (linked) {
      return NextResponse.json({
        error: 'This station is linked to a StationMGR Desktop computer. Restore the backup on that computer, or revoke it under Linked computers first.',
      }, { status: 409 })
    }

    const body = await request.json().catch(() => null)
    const out = await restoreIntoStation(supabase, {
      backup: body?.backup,
      stationId,
      ownerId: user.id,
      mode: body?.mode,
      preview: !!body?.preview,
      newId: () => crypto.randomUUID(),
    })
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 })
    if (body.preview) return NextResponse.json({ summary: out.summary })

    await logActivity(supabase, {
      orgId: stationId,
      userId: user.id,
      userName: user.name || user.email,
      content: body.mode === 'overwrite' ? 'restored a backup, overwriting everything' : 'restored a backup, padding with new values',
      actionType: 'restored_backup',
    })
    return NextResponse.json({ ok: true, counts: out.counts })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
