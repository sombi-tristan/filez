import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { getAuthUser } from '@/lib/supabaseServer'
import { checkPin, hashPin } from '@/lib/local/pin'
import { LOCAL_STATION_ID } from '@/lib/local/constants'

// POST — change your own PIN ({ current_pin, new_pin }), or, as the owner, reset a staff
// member's ({ username, new_pin }).
export async function POST(request) {
  const me = await getAuthUser()
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { current_pin, new_pin, username } = await request.json()
  if (!/^\d{4,8}$/.test(String(new_pin || ''))) return NextResponse.json({ error: 'PIN must be 4 to 8 digits' }, { status: 400 })

  if (username) {
    const { data: station } = await localDb.from('organizations').select('owner_id').eq('id', LOCAL_STATION_ID).maybeSingle()
    if (station?.owner_id !== me.id) return NextResponse.json({ error: 'Only the owner can reset a PIN' }, { status: 403 })
    const { data: target } = await localDb.from('users').select('id').eq('email', String(username).toLowerCase()).maybeSingle()
    if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    await localDb.from('users').update({ pin_hash: await hashPin(new_pin), disabled: false }).eq('id', target.id)
    return NextResponse.json({ ok: true })
  }

  const { data: row } = await localDb.from('users').select('pin_hash').eq('id', me.id).single()
  if (!(await checkPin(current_pin, row?.pin_hash))) return NextResponse.json({ error: 'Current PIN is wrong' }, { status: 401 })
  await localDb.from('users').update({ pin_hash: await hashPin(new_pin) }).eq('id', me.id)
  return NextResponse.json({ ok: true })
}
