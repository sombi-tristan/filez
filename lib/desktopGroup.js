/**
 * The name of a station's group, for a desktop computer's pull (app/api/desktop/pull): the
 * desktop picks the Rainoil workbooks by it (lib/exportGroup.js), and the groups themselves do
 * not sync to it. '' for a station in no group. Pinned by tests/desktop-group.test.mjs.
 */
export async function groupNameOf(supabase, orgId) {
  const { data: org } = await supabase.from('organizations').select('station_group_id').eq('id', orgId).maybeSingle()
  if (!org?.station_group_id) return ''
  const { data: group } = await supabase.from('station_groups').select('name').eq('id', org.station_group_id).maybeSingle()
  return group?.name || ''
}
