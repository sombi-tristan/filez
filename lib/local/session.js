/**
 * Who is signed in to the desktop app. Lives in localStorage, so it stays signed in after the
 * app is closed and opened again, until Sign out (lib/supabaseClient.js signOut). Someone else
 * at the computer signs out first and signs in with their own web account.
 */
const KEY = 'stationmgr.session'

export function getSessionUserId() {
  try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || null } catch { return null }
}

export function setSessionUserId(id) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch { /* storage unavailable */ }
}

export function clearSession() {
  setSessionUserId(null)
}
