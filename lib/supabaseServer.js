import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

/**
 * The Supabase access token the Android app sends as `Authorization: Bearer <token>`, or null.
 * The app's pages are on the phone (https://localhost), so the site's session cookies never
 * reach it; it signs each request instead. (A desktop computer's `Device <token>` is not this.)
 */
export function bearerTokenFrom(headerList) {
  const match = (headerList.get('authorization') || '').match(/^Bearer\s+(\S+)$/i)
  return match ? match[1] : null
}

/**
 * A Supabase client acting as the bearer token's user. It has no stored session, so getUser
 * checks the token, and updateUser (which reads a stored session) calls Supabase Auth directly.
 */
function createBearerSupabase(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  const getUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = (jwt = token) => getUser(jwt)
  client.auth.updateUser = async (attributes) => {
    const res = await fetch(`${url}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(attributes),
    })
    const body = await res.json().catch(() => ({}))
    if (res.ok) return { data: { user: body }, error: null }
    return { data: { user: null }, error: { message: body.msg || body.message || body.error_description || 'Could not update the account', status: res.status } }
  }
  return client
}

export async function createServerSupabase() {
  const token = bearerTokenFrom(await headers())
  if (token) return createBearerSupabase(token)

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore - cookies can only be modified in Server Actions or Route Handlers
          }
        },
      },
    }
  )
}

export function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Get the authenticated user's profile from the Supabase session.
 * Returns the same shape as the old getPinUserFromRequest:
 * { id, email, name, phone, role, org_id } or null.
 */
export async function getAuthUser() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('id, email, name, phone, role, org_id, email_verified')
    .eq('id', user.id)
    .single()

  return profile || null
}
