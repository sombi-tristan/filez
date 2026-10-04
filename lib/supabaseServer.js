import { localDb } from '@/lib/local/supabase'

// Desktop build: the "server" client is the local store. Kept under the old names so the route
// handlers in lib/local/routes run unchanged.
export async function createServerSupabase() {
  return localDb
}

export function getAdminClient() {
  return localDb
}

/** The signed-in user's profile: { id, email, name, phone, role, org_id, email_verified } or null. */
export async function getAuthUser() {
  const { data: { user } } = await localDb.auth.getUser()
  if (!user) return null

  const { data: profile } = await localDb
    .from('users')
    .select('id, email, name, phone, role, org_id, email_verified')
    .eq('id', user.id)
    .single()

  return profile || null
}
