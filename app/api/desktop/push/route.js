import { NextResponse } from 'next/server'
import { getServiceClient, requireService } from '@/lib/entryHelpers'
import { authenticateDevice, signLicence } from '@/lib/desktop'
import { SYNC_TABLES, PUSH_BATCH } from '@/lib/desktopTables'

/**
 * A desktop computer's Push: POST { changes: [{ table, op, id, row }] } with
 * `Authorization: Device <token>`, at most PUSH_BATCH changes per request, in the order made.
 *
 *   op 'upsert'  the row as it now stands on the computer
 *   op 'delete'  the row is gone on the computer. Entries are soft-deleted here (deleted_at),
 *                station setup rows are removed.
 *
 * Every row is written into the linked station whatever org_id it carries, and attributed to
 * the owner who linked the computer (its staff exist only on the computer). A write to an entry
 * table needs the same subscription the web asks for. Each change is answered on its own, so
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

    const supabase = getServiceClient()
    const orgId = linked.station.id
    const user = { ...linked.user, org_id: orgId }
    const serviceOk = {}
    const results = []

    for (const change of changes) {
      const { table, op, id } = change || {}
      const spec = SYNC_TABLES[table]
      const answer = (ok, error) => results.push({ table, id, ok, ...(error ? { error } : {}) })
      if (!spec || !id || (op !== 'upsert' && op !== 'delete')) { answer(false, 'Not a change this computer can make'); continue }

      if (spec.service) {
        if (serviceOk[spec.service] === undefined) serviceOk[spec.service] = (await requireService(user, spec.service)).subscribed
        if (!serviceOk[spec.service]) { answer(false, 'Subscription required for this service'); continue }
      }

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

      // A row that already exists in another station is never taken over.
      const { data: existing } = await supabase.from(table).select('org_id').eq('id', id).maybeSingle()
      if (existing && existing.org_id !== orgId) { answer(false, 'That record belongs to another station'); continue }

      const row = { ...(change.row || {}), id, org_id: orgId }
      if ('created_by' in row) row.created_by = linked.user.id
      // Receipt images stay on the computer: a data: URL is far too large to move this way.
      if (typeof row.receipt_image_url === 'string' && row.receipt_image_url.startsWith('data:')) row.receipt_image_url = null
      const { error } = await supabase.from(table).upsert(row)
      answer(!error, error ? (error.code === '23505' ? 'Already recorded for that day' : error.message) : null)
    }

    const licence = await signLicence({ orgId, deviceId: linked.device.id, stationName: linked.station.name })
    return NextResponse.json({ results, licence })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
