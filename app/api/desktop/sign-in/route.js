import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/entryHelpers'
import { rateLimit } from '@/lib/rateLimit'
import { accountFor } from '@/lib/desktopAccount'

/**
 * StationMGR Desktop signs someone in with their web account: one account on the website and
 * every computer, no PINs (lib/desktopAccount.js).
 *
 * POST { email, password } → { user: { id, name, email }, stations: [{ id, name, location, role,
 * visiblePages }], invites: [{ id, stationId, stationName, location }] } (pending invites, to
 * accept on the web). The password is checked against Supabase Auth and never stored here; the
 * computer keeps its own check of it so the next sign-in works offline.
 */
export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(`desktop-sign-in:${ip}`, 20).success) {
      return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 })
    }

    const { email, password } = await request.json().catch(() => ({}))
    if (!email || !password) return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })

    const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signedIn, error } = await auth.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: String(password) })
    if (error || !signedIn?.user) return NextResponse.json({ error: 'Wrong email or password' }, { status: 401 })
    // The session was only needed to prove the password; nothing is kept. Only it ends: the
    // default signs the account out everywhere, the owner's phone with it.
    auth.auth.signOut({ scope: 'local' }).catch(() => {})

    const account = await accountFor(getServiceClient(), signedIn.user.id)
    if (account.error) return NextResponse.json({ error: account.error }, { status: 403 })
    return NextResponse.json(account)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
