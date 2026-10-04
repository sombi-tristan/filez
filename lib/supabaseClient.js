import { localDb } from '@/lib/local/supabase'
import { clearSession } from '@/lib/local/session'

// Desktop build: no Supabase. Same exports as before, backed by the local session.
export const supabase = {
  ...localDb,
  auth: {
    ...localDb.auth,
    async signOut() {
      clearSession()
      return { error: null }
    },
  },
}

export const getClientUser = async () => {
  const { data: { user } } = await localDb.auth.getUser()
  return user ?? null
}

export const getSession = async () => {
  const { data: { session } } = await localDb.auth.getSession()
  return session
}

export const signOut = async () => {
  clearSession()
  return { error: null }
}
