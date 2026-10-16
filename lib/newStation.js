/**
 * A new web station made from a StationMGR Desktop computer's records (app/api/desktop/link
 * with createName). It is made as app/api/organizations makes one: owned by the owner who signed
 * in, with a unique slug, and set as their station. It starts with no subscription, so the
 * computer's records wait there and go up with its first push once one is running.
 *
 * Takes the Supabase client, so tests/desktop-create-station.test.mjs can pass a stand-in.
 */

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** The slug for a station name, given the slugs already taken. */
export function stationSlug(name, taken = []) {
  const slug = slugify(name) || 'station'
  return taken.includes(slug) ? `${slug}-${Date.now().toString(36)}` : slug
}

/** Returns { station: { id, name, location } } or { error }. */
export async function createOwnedStation(supabase, { ownerId, name }) {
  const clean = String(name || '').trim()
  if (!clean || clean.length > 100) return { error: 'Station name is required (max 100 characters)' }

  const base = stationSlug(clean)
  const { data: clash } = await supabase.from('organizations').select('id').eq('slug', base).maybeSingle()
  const slug = clash ? stationSlug(clean, [base]) : base

  const { data: station, error } = await supabase
    .from('organizations')
    .insert({ name: clean, slug, owner_id: ownerId })
    .select('id, name, location')
    .single()
  if (error || !station) return { error: 'Could not create the station' }

  await supabase.from('users').update({ org_id: station.id }).eq('id', ownerId)
  return { station }
}
