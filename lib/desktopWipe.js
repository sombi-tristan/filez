/**
 * Clears a web station's copy for its linked StationMGR Desktop computer, which then pushes all
 * of its own records (app/api/desktop/wipe): the station on the computer is the source of truth
 * when it corrects something. Every synced table but the station row is cleared for that
 * station only, in reverse push order (entries before the setup they point at), and for good:
 * a soft-deleted close of business would still refuse the computer's own for that day.
 *
 * Takes the Supabase client, so tests/desktop-wipe.test.mjs can pass a stand-in.
 *
 *   order  the synced tables in push order (lib/desktopTables.js PUSH_ORDER)
 */
export async function wipeStation(supabase, orgId, order) {
  for (const table of [...order].reverse()) {
    if (table === 'organizations') continue
    const { error } = await supabase.from(table).delete().eq('org_id', orgId)
    if (error) return { ok: false, error: `Could not clear ${table}: ${error.message}` }
  }
  return { ok: true }
}
