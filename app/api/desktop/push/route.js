import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/entryHelpers'
import { authenticateDevice, signLicence, serviceDates } from '@/lib/desktop'
import { SYNC_TABLES, PUSH_BATCH } from '@/lib/desktopTables'
import { conflictMessage } from '@/lib/desktopConflicts'
import { consolidatedEntryError } from '@/lib/consolidation'

/**
 * A desktop computer's Push: POST { changes: [{ table, op, id, row }] } with
 * `Authorization: Device <token>`, at most PUSH_BATCH changes per request, in the order made.
 *
 *   op 'upsert'  the row as it now stands on the computer
 *   op 'delete'  the row is gone on the computer. Entries are soft-deleted here (deleted_at),
 *                station setup rows are removed.
 *
 * Every row is written into the linked station whatever org_id it carries. Who added and who
 * last edited an entry (created_by, updated_by) are kept when they are web accounts, as people
 * on a computer sign in with theirs; otherwise (an old PIN account) they are the owner who
 * linked the computer. A push needs any
 * service running (403 otherwise, with a fresh licence), and a write to an entry table its own
 * service (lib/desktopTables.js), grace included as in the licence. Each change is answered on its own, so
 * one refused row (a second close of business for a day, a lapsed service) does not stop the
 * rest: { results: [{ table, id, ok, error? }], licence }.
 */
export async function POST(request) {
  try {
    const linked = await authenticateDevice(request)
    if (!linked) return NextResponse.json({ error: 'This computer is not linked' }, { status: 401 })

    const { changes } = await request.json().catch(() => ({}))
    if (!Array.isArray(changes)) return NextResponse.json({ error: 'changes is required' }, { status: 400 })
    if (changes.length > PUSH_BATCH) return NextResponse.json({ error: `At most ${PUSH_BATCH} changes per push` }, { status: 400 })

    const orgId = linked.station.id
    const running = await serviceDates(orgId)
    if (!Object.keys(running).length) {
      const licence = await signLicence({ orgId, deviceId: linked.device.id, stationName: linked.station.name })
      return NextResponse.json({ error: 'Push needs the station to have a subscription running', licence }, { status: 403 })
    }

    const supabase = getServiceClient()
    const results = []

    // The web accounts among the people named on these rows, looked up once.
    const authors = [...new Set(changes.flatMap((c) => [c?.row?.created_by, c?.row?.updated_by]).filter((v) => typeof v === 'string'))]
    const known = new Set((await supabase.from('users').select('id').in('id', authors)).data?.map((u) => u.id) || [])

    for (const change of changes) {
      const { table, op, id } = change || {}
      const spec = SYNC_TABLES[table]
      const answer = (ok, error) => results.push({ table, id, ok, ...(error ? { error } : {}) })
      if (!spec || !id || (op !== 'upsert' && op !== 'delete')) { answer(false, 'Not a change this computer can make'); continue }

      if (spec.service && !running[spec.service]) { answer(false, 'Subscription required for this service'); continue }

      if (table === 'organizations') {
        if (id !== orgId || op !== 'upsert') { answer(false, 'Only this station can be changed'); continue }
        const updates = Object.fromEntries(spec.columns.filter((c) => change.row && c in change.row).map((c) => [c, change.row[c]]))
        const { error } = await supabase.from('organizations').update(updates).eq('id', orgId)
        answer(!error, error?.message)
        continue
      }

      if (op === 'delete') {
        const query = spec.entries
          ? supabase.from(table).update({ deleted_at: new Date().toISOString() })
          : supabase.from(table).delete()
        const { error } = await query.eq('id', id).eq('org_id', orgId)
        answer(!error, error?.message)
        continue
      }

      // An entry for a date the weekly job has already rolled into the opening balances would
      // count twice (lib/consolidation.js). A deletion of one goes through above: it is gone.
      const old = consolidatedEntryError(table, change.row?.entry_date)
      if (old) { answer(false, old); continue }

      // A row that already exists in another station is never taken over.
      const { data: existing } = await supabase.from(table).select('org_id').eq('id', id).maybeSingle()
      if (existing && existing.org_id !== orgId) { answer(false, 'That record belongs to another station'); continue }

      const row = { ...(change.row || {}), id, org_id: orgId }
      if ('created_by' in row) row.created_by = known.has(row.created_by) ? row.created_by : linked.user.id
      if (row.updated_by) row.updated_by = known.has(row.updated_by) ? row.updated_by : linked.user.id
      // Receipt images stay on the computer: a data: URL is far too large to move this way.
      if (typeof row.receipt_image_url === 'string' && row.receipt_image_url.startsWith('data:')) row.receipt_image_url = null
      const { error } = await supabase.from(table).upsert(row)
      answer(!error, error ? (error.code === '23505' ? conflictMessage(table, row) : error.message) : null)
    }

    const licence = await signLicence({ orgId, deviceId: linked.device.id, stationName: linked.station.name })
    return NextResponse.json({ results, licence })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
