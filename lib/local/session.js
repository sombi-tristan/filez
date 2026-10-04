/**
 * Who is signed in to the desktop app. Lives in sessionStorage, so it survives navigation and
 * reloads but not closing the app: the next person at the till signs in with their own PIN.
 */
const KEY = 'stationmgr.session'

export function getSessionUserId() {
  try { return sessionStorage.getItem(KEY) || null } catch { return null }
}

export function setSessionUserId(id) {
  try {
    if (id) sessionStorage.setItem(KEY, id)
    else sessionStorage.removeItem(KEY)
  } catch { /* storage unavailable */ }
}

export function clearSession() {
  setSessionUserId(null)
}
