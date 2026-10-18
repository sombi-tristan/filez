import { restoreIntoPlan, summarize, RESTORE_TABLES } from './restoreInto.js'

/**
 * Restore from backup on the web (app/api/stations/[stationId]/restore): a StationMGR Desktop
 * backup file restored into a web station, overwrite or pad (lib/restoreInto.js decides what).
 * The station's name, owner and group stay; only its setup and entries change.
 *
 * Takes the Supabase client, so tests/web-restore.test.mjs can pass a stand-in.
 *
 *   preview  only say what differs, for the warning: { ok, summary, here }
 *   mode     'overwrite' or 'pad': { ok, counts }
 *
 * There is no transaction across these calls: an overwrite clears the station first, and a
 * failure part way names the table, so the restore can be run again.
 */
export const BACKUP_FORMAT = 'stationmgr-backup'

const PAGE = 1000 // PostgREST's most rows per read
const BATCH = 200

/** Every row of a station's table, page by page. */
async function allRows(supabase, table, stationId) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').eq('org_id', stationId).range(from, from + PAGE - 1)
    if (error) throw new Error(`Could not read ${table}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < PAGE) return out
  }
}

// A column the web table does not have (a desktop backup can carry one): PostgREST names it.
const missingColumn = (error) => error?.code === 'PGRST204' && /'([^']+)' column/.exec(error.message || '')?.[1]

/** Inserts rows in batches, leaving out any column the table does not have. */
async function insertAll(supabase, table, rows) {
  let dropped = new Set()
  for (let i = 0; i < rows.length; i += BATCH) {
    for (let tries = 0; ; tries++) {
      const batch = rows.slice(i, i + BATCH).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !dropped.has(k))))
      const { error } = await supabase.from(table).insert(batch)
      if (!error) break
      const column = missingColumn(error)
      if (!column || tries > 20) throw new Error(`Could not restore ${table}: ${error.message}`)
      dropped = new Set([...dropped, column])
    }
  }
}

export async function restoreIntoStation(supabase, { backup, stationId, ownerId, mode, preview = false, newId }) {
  if (backup?.format !== BACKUP_FORMAT || !backup.tables?.organizations?.length) {
    return { ok: false, error: 'That file is not a StationMGR backup' }
  }
  try {
    const here = {}
    for (const t of RESTORE_TABLES) here[t] = await allRows(supabase, t, stationId)
    if (preview) {
      return { ok: true, summary: summarize(backup, here), here: Object.fromEntries(RESTORE_TABLES.map((t) => [t, here[t].length])) }
    }
    if (mode !== 'overwrite' && mode !== 'pad') return { ok: false, error: 'Choose overwrite or pad' }

    const { puts, deletes } = restoreIntoPlan({ backup, here, mode, stationId, newId })

    // Cleared for good, entries before the setup they point at: a soft-deleted close of business
    // would still refuse the backup's for that day.
    if (mode === 'overwrite') {
      for (const t of [...RESTORE_TABLES].reverse()) {
        const { error } = await supabase.from(t).delete().eq('org_id', stationId)
        if (error) throw new Error(`Could not clear ${t}: ${error.message}`)
      }
    }

    for (const t of RESTORE_TABLES) {
      const rows = puts[t].map((r) => {
        const row = { ...r }
        // The computer's staff are not web accounts: what they entered is the owner's here.
        if ('created_by' in row) row.created_by = ownerId
        // Receipt images held in the file are far too large to keep in a row.
        if (typeof row.receipt_image_url === 'string' && row.receipt_image_url.startsWith('data:')) row.receipt_image_url = null
        return row
      })
      await insertAll(supabase, t, rows)
    }

    // Restored, the station's setup is done when the backup's was.
    if (backup.tables.organizations[0].onboarding_complete) {
      await supabase.from('organizations').update({ onboarding_complete: true }).eq('id', stationId)
    }

    const counts = Object.fromEntries(RESTORE_TABLES.map((t) => [t, { added: puts[t].length, removed: deletes[t].length }]))
    return { ok: true, counts }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
