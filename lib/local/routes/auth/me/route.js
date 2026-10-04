import { NextResponse } from '@/lib/local/nextServer'
import { createServerSupabase } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ user: null })

    const { data: profile } = await supabase
      .from('users')
      .select('id, name, role, email, email_verified')
      .eq('id', user.id)
      .single()

    if (!profile) return NextResponse.json({ user: null })

    return NextResponse.json({
      user: {
        id: profile.id,
        name: profile.name,
        role: profile.role,
        email: profile.email,
        email_verified: profile.email_verified,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
