import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/entryHelpers'
import { rateLimit } from '@/lib/rateLimit'
import { accountFor, signUpWith } from '@/lib/desktopAccount'

/**
 * StationMGR Desktop creates a web account, as the website's sign-up does (lib/desktopAccount.js).
 *
 * POST { name, email, password } → the same answer as sign-in: { user, stations } (none yet).
 */
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(`desktop-sign-up:${ip}`, 10).success) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
    }

    const { name, email, password } = await request.json().catch(() => ({}))
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const made = await signUpWith(anon, { name, email, password })
    if (made.error) return NextResponse.json({ error: made.error }, { status: 400 })

    const account = await accountFor(getServiceClient(), made.userId)
    if (account.error) return NextResponse.json({ error: account.error }, { status: 403 })
    return NextResponse.json(account)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
