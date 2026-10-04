import { NextResponse } from '@/lib/local/nextServer'
import { getAuthUser, getAdminClient } from '@/lib/supabaseServer'
import { hasStationAccess } from '@/lib/stationAccess'
import { logStationAssist } from '@/lib/adminActivity'
import { rateLimit } from '@/lib/rateLimit'
import { DEFAULT_ACCOUNTS, DEFAULT_PHONE, DEFAULT_LUBE_PRODUCTS } from '@/lib/defaultAccounts'

// Upsert helper: update items with id, insert new items, delete removed items
// protectPhone: if set, rows with this phone value are never deleted
async function upsertConfigTable(supabase, table, orgId, items, buildRow, protectPhone) {
  // Get existing rows for this org
  const cols = protectPhone ? 'id, phone' : 'id'
  const { data: existing } = await supabase
    .from(table)
    .select(cols)
    .eq('org_id', orgId)

  const existingIds = new Set((existing || []).map((e) => e.id))
  const incomingIds = new Set()

  // IDs that are protected (default accounts)
  const protectedIds = protectPhone
    ? new Set((existing || []).filter(e => e.phone === protectPhone).map(e => e.id))
    : new Set()

  const toUpdate = []
  const toInsert = []

  for (let i = 0; i < items.length; i++) {
    const row = buildRow(items[i], i)
    if (items[i].id && existingIds.has(items[i].id)) {
      // Existing item — update (but don't update protected defaults)
      if (!protectedIds.has(items[i].id)) {
        toUpdate.push({ id: items[i].id, ...row })
      }
      incomingIds.add(items[i].id)
    } else {
      // New item — insert
      toInsert.push({ org_id: orgId, ...row })
    }
  }

  // Delete items that were removed by user (but never delete protected)
  const toDelete = [...existingIds].filter((id) => !incomingIds.has(id) && !protectedIds.has(id))

  // Execute
  for (const row of toUpdate) {
    const { id, ...fields } = row
    await supabase.from(table).update(fields).eq('id', id)
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from(table).insert(toInsert)
    if (error) return { error }
  }

  if (toDelete.length > 0) {
    await supabase.from(table).delete().in('id', toDelete)
  }

  return { error: null }
}

/** Insert default accounts for a station if they don't already exist */
async function ensureDefaultAccounts(supabase, orgId) {
  const { data: existing } = await supabase
    .from('station_customers')
    .select('name')
    .eq('org_id', orgId)
    .eq('phone', DEFAULT_PHONE)

  const existingNames = new Set((existing || []).map(e => e.name))
  const toInsert = DEFAULT_ACCOUNTS
    .filter(name => !existingNames.has(name))
    .map((name, i) => ({
      org_id: orgId,
      name,
      phone: DEFAULT_PHONE,
      opening_balance: 0,
      opening_date: new Date().toISOString().split('T')[0],
      sort_order: 1000 + i, // after user-created accounts
    }))

  if (toInsert.length > 0) {
    await supabase.from('station_customers').insert(toInsert)
  }
}

/** Insert default lube products for a station if they don't already exist */
async function ensureDefaultLubeProducts(supabase, orgId) {
  const { data: existing } = await supabase
    .from('station_lube_products')
    .select('product_name')
    .eq('org_id', orgId)

  const existingNames = new Set((existing || []).map(e => e.product_name))
  const toInsert = DEFAULT_LUBE_PRODUCTS
    .filter(name => !existingNames.has(name))
    .map((name, i) => ({
      org_id: orgId,
      product_name: name,
      unit_price: 0,
      opening_stock: 0,
      opening_date: new Date().toISOString().split('T')[0],
      sort_order: 1000 + i,
    }))

  if (toInsert.length > 0) {
    await supabase.from('station_lube_products').insert(toInsert)
  }
}

// POST — save all onboarding data for a station
export async function POST(request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { success } = rateLimit(`onboard:${user.id}`, 10)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const { org_id, location, nozzles, tanks, mappings, lodgements, lube_products, customers } = await request.json()

    if (!org_id) {
      return NextResponse.json({ error: 'Station id required' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // Owner, accepted staff, or platform admin. It was owner-only, which meant an admin
    // could not run setup for a station they were onboarding: the wizard loaded, five steps
    // were filled in, and the save 404'd at the end.
    const { ok, via } = await hasStationAccess(user, org_id)
    if (!ok) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 })
    }

    // 1. Update station location
    if (location) {
      await supabase
        .from('organizations')
        .update({ location: location.trim() })
        .eq('id', org_id)
    }

    // 2. Upsert nozzles (station_pumps)
    if (nozzles) {
      const { error: nozzleErr } = await upsertConfigTable(
        supabase, 'station_pumps', org_id, nozzles,
        (n, i) => ({
          fuel_type: n.fuel_type,
          pump_number: n.pump_number,
          initial_reading: n.initial_reading || 0,
          sort_order: i,
        })
      )
      if (nozzleErr) {
        return NextResponse.json({ error: 'Failed to save nozzles' }, { status: 500 })
      }
    }

    // 3. Upsert tanks
    if (tanks) {
      const { error: tankErr } = await upsertConfigTable(
        supabase, 'station_tanks', org_id, tanks,
        (t, i) => ({
          fuel_type: t.fuel_type,
          tank_number: t.tank_number,
          capacity: t.capacity || 0,
          opening_stock: t.opening_stock || 0,
          sort_order: i,
        })
      )
      if (tankErr) {
        return NextResponse.json({ error: 'Failed to save tanks' }, { status: 500 })
      }
    }

    // 4. Apply tank-to-nozzle mappings
    if (mappings && mappings.length > 0 && tanks) {
      // Get current tanks and nozzles for this org
      const [{ data: savedTanks }, { data: savedNozzles }] = await Promise.all([
        supabase.from('station_tanks').select('id, fuel_type, tank_number').eq('org_id', org_id),
        supabase.from('station_pumps').select('id, fuel_type, pump_number').eq('org_id', org_id),
      ])

      if (savedTanks && savedNozzles) {
        const tankLookup = {}
        for (const t of savedTanks) {
          tankLookup[`${t.fuel_type}-${t.tank_number}`] = t.id
        }

        for (const m of mappings) {
          const tankId = tankLookup[`${m.fuel_type}-${m.tank_number}`]
          if (tankId) {
            await supabase
              .from('station_pumps')
              .update({ tank_id: tankId })
              .eq('org_id', org_id)
              .eq('fuel_type', m.fuel_type)
              .eq('pump_number', m.nozzle_pump_number)
          }
        }
      }
    }

    // 5. Upsert lodgements (station_banks)
    if (lodgements) {
      const { error: lodgeErr } = await upsertConfigTable(
        supabase, 'station_banks', org_id, lodgements,
        (l, i) => ({
          bank_name: l.bank_name,
          lodgement_type: l.lodgement_type,
          terminal_id: l.terminal_id || null,
          opening_balance: l.opening_balance ?? l.balance ?? 0,
          sort_order: i,
        })
      )
      if (lodgeErr) {
        return NextResponse.json({ error: 'Failed to save lodgements' }, { status: 500 })
      }
    }

    // 6. Upsert lube products
    if (lube_products) {
      const { error: lubeErr } = await upsertConfigTable(
        supabase, 'station_lube_products', org_id, lube_products,
        (lp, i) => ({
          product_name: lp.product_name,
          unit_price: lp.unit_price || 0,
          opening_stock: lp.opening_stock || 0,
          opening_date: lp.opening_date || new Date().toISOString().split('T')[0],
          sort_order: i,
        })
      )
      if (lubeErr) {
        return NextResponse.json({ error: 'Failed to save lube products' }, { status: 500 })
      }
    }

    // 7. Upsert credit customers (skip deleting defaults)
    if (customers) {
      const { error: custErr } = await upsertConfigTable(
        supabase, 'station_customers', org_id, customers,
        (c, i) => ({
          name: c.name,
          phone: c.phone || null,
          opening_balance: c.opening_balance || 0,
          opening_date: c.opening_date || new Date().toISOString().split('T')[0],
          sort_order: i,
        }),
        DEFAULT_PHONE // protect default accounts from deletion
      )
      if (custErr) {
        return NextResponse.json({ error: 'Failed to save customers' }, { status: 500 })
      }
    }

    // 7b. Ensure default accounts exist for this station
    await ensureDefaultAccounts(supabase, org_id)
    await ensureDefaultLubeProducts(supabase, org_id)

    // 8. Mark onboarding as complete + ensure the OWNER's org_id is set.
    //
    // This used to write org_id onto the acting user, which was the same person back when
    // only an owner could get here. Now that an admin can run setup on someone's behalf,
    // that would silently repoint the ADMIN's own default station at the station they were
    // setting up. The owner is read from the station rather than assumed.
    const { data: station } = await supabase
      .from('organizations').select('owner_id, name').eq('id', org_id).maybeSingle()

    await Promise.all([
      supabase.from('organizations').update({ onboarding_complete: true }).eq('id', org_id),
      station?.owner_id
        ? supabase.from('users').update({ org_id }).eq('id', station.owner_id)
        : Promise.resolve(),
    ])

    // Only records something when `via` is 'admin'; a no-op for the owner and for staff.
    await logStationAssist({
      user, via, orgId: org_id, request,
      actionType: 'onboarding_saved',
      content: `ran setup for ${station?.name || 'a station'} on their behalf`,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
