// Desktop build: there is no platform staff acting on other people's stations, so nothing to
// audit. Kept as no-ops so the shared route code can call these unconditionally.
export async function logAdminActivity() {}
export async function logStationAssist() {}
