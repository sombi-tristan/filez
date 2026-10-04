import { NextResponse } from '@/lib/local/nextServer'
import { localDb } from '@/lib/local/supabase'
import { checkPin } from '@/lib/local/pin'
import { setSessionUserId } from '@/lib/local/session'
import { rateLimit } from '@/lib/rateLimit'

// POST — sign in with a PIN. Five wrong tries locks that person out for five minutes.
export async function POST(request) {
  const { userId, pin } = await request.json()
  if (!userId || !pin) return NextResponse.json({ error: 'Choose your name and enter your PIN' }, { status: 400 })

  const { data: user } = await localDb.from('users').select('id, pin_hash, disabled').eq('id', userId).maybeSingle()
  if (!user || !user.pin_hash || user.disabled) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const { success } = rateLimit(`pin:${userId}`, 5, 5 * 60 * 1000)
  if (!success) return NextResponse.json({ error: 'Too many wrong PINs. Wait 5 minutes and try again.' }, { status: 429 })

  if (!(await checkPin(pin, user.pin_hash))) return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })

  setSessionUserId(user.id)
  return NextResponse.json({ ok: true })
}
