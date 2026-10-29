/**
 * Test data for the JSON datastore (lib/jsondb): `npm run jsondb:seed` wipes jsondb/data and
 * writes one station with a month of trading up to yesterday, dated back from today so it never
 * falls behind the 90-day consolidation cutoff (lib/consolidation.js).
 *
 * Sign in with:
 *   owner@test.local / password123   station owner (the dashboard; phone or tablet width)
 *   staff@test.local / password123   staff member invited to the station
 *   admin@test.local / password123   platform admin (sees the dashboard on a computer too)
 *
 * The numbers hang together the way a real station's do: meters only climb, tanks fall by
 * what the pumps sold and rise by each delivery, lodgements add up to the day's sales.
 * Same output every run for the same date (a seeded random), so a reset is predictable.
 */
import { rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = process.env.JSONDB_DIR || join(root, 'jsondb', 'data')
const DAYS = 30 // one month of trading, up to yesterday
const PASSWORD = 'password123'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** A fixed UUID per name, so ids are stable across resets. */
function uuid(name) {
  const h = createHash('sha1').update(`stationmgr-test:${name}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

let seed = 20260301
function random() {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (lo, hi) => Math.round(lo + random() * (hi - lo))
const pick = (list) => list[Math.floor(random() * list.length)]

const today = new Date()
today.setUTCHours(0, 0, 0, 0)
const day = (offset) => new Date(today.getTime() + offset * 86400000).toISOString().slice(0, 10)
const at = (date, hour, minute = 0) => `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`

const tables = {}
const add = (table, row) => (tables[table] ||= []).push(row)

// ── People ───────────────────────────────────────────────────────────────────

const START = day(-DAYS) // the station's opening date: balances are as at this day
const created = at(day(-DAYS - 2), 9)

const OWNER = uuid('user:owner'), STAFF = uuid('user:staff'), ADMIN = uuid('user:admin')
const STATION = uuid('org:station')
const people = [
  { id: OWNER, email: 'owner@test.local', name: 'Tunde Bakare', phone: '08030000001', role: 'user', org_id: STATION },
  { id: STAFF, email: 'staff@test.local', name: 'Amaka Obi', phone: '08030000002', role: 'user', org_id: STATION },
  { id: ADMIN, email: 'admin@test.local', name: 'Test Admin', phone: '08030000003', role: 'admin', org_id: null },
]
for (const p of people) {
  add('auth_users', {
    id: p.id, email: p.email, phone: p.phone, password: PASSWORD,
    user_metadata: { name: p.name, phone: p.phone },
    email_confirmed_at: created, created_at: created, updated_at: created, last_sign_in_at: null,
  })
  add('users', {
    id: p.id, email: p.email, name: p.name, phone: p.phone, role: p.role, created_at: created,
    org_id: p.org_id, pin_hash: null, password_hash: null, must_change_password: false, email_verified: true,
  })
}

// ── Station and subscription ─────────────────────────────────────────────────

const GROUP = uuid('group:lagos')
add('station_groups', { id: GROUP, owner_id: OWNER, name: 'Lagos Stations', created_at: created })
add('organizations', {
  id: STATION, name: 'TEST STATION Lekki', slug: 'test-station-lekki', owner_id: OWNER, created_at: created,
  plan_type: 'recurring', location: 'Lekki Phase 1, Lagos', onboarding_complete: true,
  station_group: 'Lagos Stations', station_group_id: GROUP,
})

const services = [
  { key: 'fuel-operations', name: 'Daily Sales Operations', description: 'Daily sales, product receipt, and lodgements' },
  { key: 'lube-management', name: 'Lube Management', description: 'Lube sales and stock entries' },
  { key: 'customer-payments', name: 'Customer Payments', description: 'Customer sales and payment records' },
]
for (const s of services) add('services', { id: uuid(`service:${s.key}`), ...s, price: 0, is_active: true, created_at: created })

const SUB = uuid('subscription:1')
add('subscriptions', {
  id: SUB, user_id: OWNER, status: 'approved', payment_reference: 'TEST-PAY-0001', proof_url: null,
  start_date: at(START, 0), end_date: at(day(365 - DAYS), 0), renewed_at: null, notes: 'Seeded test subscription',
  created_at: created, plan_type: 'yearly', total_amount: 0, org_id: STATION, reference_code: 'SMGR-TEST01',
  payment_deadline: null, months: 12, verification_suffix: null, verification_confidence: null, verified_by: ADMIN,
})
for (const s of services) {
  add('subscription_items', { id: uuid(`subitem:${s.key}`), subscription_id: SUB, service_id: uuid(`service:${s.key}`), service_name: s.name, price: 0, created_at: created })
}

add('org_invites', {
  id: uuid('invite:staff'), org_id: STATION, email: 'staff@test.local', status: 'accepted',
  invited_at: created, responded_at: created,
  visible_pages: ['daily-sales', 'product-receipt', 'lodgements', 'lube', 'customer-payments', 'report-summary', 'report-daily-sales', 'report-audit', 'report-account-ledger', 'report-product-received'],
})

// ── Station setup: tanks, nozzles, banks, lubes, customers ───────────────────

const tanks = [
  { key: 'pms1', fuel: 'PMS', number: 1, capacity: 33000, opening: 21000 },
  { key: 'pms2', fuel: 'PMS', number: 2, capacity: 33000, opening: 17500 },
  { key: 'ago', fuel: 'AGO', number: 1, capacity: 33000, opening: 19000 },
  { key: 'dpk', fuel: 'DPK', number: 1, capacity: 15000, opening: 8000 },
]
tanks.forEach((t, i) => {
  t.id = uuid(`tank:${t.key}`)
  t.label = t.fuel === 'PMS' ? `PMS Tank ${t.number}` : `${t.fuel} Tank`
  add('station_tanks', {
    id: t.id, org_id: STATION, fuel_type: t.fuel, tank_number: t.number, capacity: t.capacity,
    sort_order: i, created_at: created, opening_stock: t.opening, opening_date: START,
  })
})
const tankByKey = Object.fromEntries(tanks.map((t) => [t.key, t]))

const nozzles = [
  { label: 'PMS 1', fuel: 'PMS', tank: 'pms1', meter: 945281, sells: [900, 1500] },
  { label: 'PMS 2', fuel: 'PMS', tank: 'pms1', meter: 913278, sells: [850, 1450] },
  { label: 'PMS 3', fuel: 'PMS', tank: 'pms1', meter: 1363469, sells: [800, 1400] },
  { label: 'PMS 4', fuel: 'PMS', tank: 'pms1', meter: 1149584, sells: [700, 1300] },
  { label: 'PMS 5', fuel: 'PMS', tank: 'pms2', meter: 1214846, sells: [850, 1450] },
  { label: 'PMS 6', fuel: 'PMS', tank: 'pms2', meter: 1040351, sells: [800, 1400] },
  { label: 'PMS 7', fuel: 'PMS', tank: 'pms2', meter: 1012522, sells: [700, 1300] },
  { label: 'PMS 8', fuel: 'PMS', tank: 'pms2', meter: 1146741, sells: [600, 1200] },
  { label: 'AGO 1', fuel: 'AGO', tank: 'ago', meter: 305900, sells: [450, 900] },
  { label: 'AGO 2', fuel: 'AGO', tank: 'ago', meter: 255784, sells: [350, 800] },
  { label: 'DPK 1', fuel: 'DPK', tank: 'dpk', meter: 70080, sells: [90, 240] },
  { label: 'DPK 2', fuel: 'DPK', tank: 'dpk', meter: 98301, sells: [70, 200] },
]
nozzles.forEach((n, i) => {
  n.id = uuid(`pump:${n.label}`)
  add('station_pumps', {
    id: n.id, org_id: STATION, fuel_type: n.fuel, pump_number: Number(n.label.split(' ')[1]),
    initial_reading: n.meter, sort_order: i, created_at: created, nozzle_label: n.label,
    tank_id: tankByKey[n.tank].id, opening_date: START,
  })
})

const banks = [
  { key: 'moniepoint', name: 'Moniepoint POS', type: 'pos', terminal: '2KA10001', share: 0.38 },
  { key: 'opay', name: 'OPay POS', type: 'pos', terminal: '2OP20002', share: 0.22 },
  { key: 'gtb', name: 'GTBank Transfer', type: 'transfer', terminal: null, share: 0.18 },
  { key: 'zenith', name: 'Zenith Bank (Cash Deposit)', type: 'bank_deposit', terminal: null, share: 0.22 },
]
banks.forEach((b, i) => {
  b.id = uuid(`bank:${b.key}`)
  add('station_banks', {
    id: b.id, org_id: STATION, bank_name: b.name, sort_order: i, created_at: created,
    lodgement_type: b.type, terminal_id: b.terminal, opening_balance: 0, opening_date: START,
  })
})

/**
 * The default lube products every station gets at onboarding (lib/defaultAccounts.js
 * DEFAULT_LUBE_PRODUCTS), in that order. `daily` is how many sell on a usual day, as a range;
 * `restockAt` is the count at which a carton is ordered and `carton` how many come in it.
 */
const lubes = [
  { name: 'RAINOIL SUPREME 4L', price: 16500, cost: 14200, stock: 36, daily: [1, 4], restockAt: 8, carton: 24 },
  { name: 'RAINOIL UNIVERSAL SAE 40 4L', price: 13500, cost: 11600, stock: 40, daily: [1, 5], restockAt: 10, carton: 24 },
  { name: 'RAINOIL UNIVERSAL SAE 40 25L', price: 78000, cost: 69500, stock: 6, daily: [0, 1], restockAt: 2, carton: 4 },
  { name: 'MAGNATEC 10W-40 4L', price: 24500, cost: 21300, stock: 18, daily: [0, 2], restockAt: 5, carton: 12 },
  { name: 'INJECTOR CLEANER', price: 4500, cost: 3500, stock: 30, daily: [0, 3], restockAt: 8, carton: 24 },
  { name: 'MAGNATEC 5W-30 1L', price: 8200, cost: 6900, stock: 24, daily: [0, 3], restockAt: 6, carton: 12 },
  { name: 'MAGNATEC 5W-30 4L', price: 29500, cost: 25800, stock: 16, daily: [0, 2], restockAt: 4, carton: 12 },
  { name: 'MAGNATEC 5W-30 A5', price: 36000, cost: 31500, stock: 10, daily: [0, 1], restockAt: 3, carton: 6 },
  { name: 'RAINOIL SUPREME 1L', price: 4600, cost: 3800, stock: 48, daily: [1, 5], restockAt: 12, carton: 24 },
  { name: 'RADICOOL', price: 5200, cost: 4100, stock: 30, daily: [0, 3], restockAt: 8, carton: 24 },
  { name: 'BRAKE FLUID DOT 4 0.2L', price: 1800, cost: 1300, stock: 40, daily: [0, 3], restockAt: 10, carton: 48 },
  { name: 'BRAKE FLUID DOT 4 0.5L', price: 3600, cost: 2800, stock: 24, daily: [0, 2], restockAt: 6, carton: 24 },
  { name: 'GT X ESSENTIAL 20W-50 1L', price: 6800, cost: 5700, stock: 24, daily: [0, 3], restockAt: 6, carton: 12 },
  { name: 'GT X ESSENTIAL 20W-50 4L', price: 24000, cost: 20800, stock: 18, daily: [0, 2], restockAt: 5, carton: 12 },
  { name: 'POWER RACING 40 10W-50', price: 9500, cost: 7900, stock: 20, daily: [0, 2], restockAt: 5, carton: 12 },
  { name: 'MOTOR OIL SAE 40', price: 11500, cost: 9600, stock: 30, daily: [1, 4], restockAt: 8, carton: 24 },
  { name: 'EDGE PROFESSIONAL', price: 42000, cost: 36800, stock: 8, daily: [0, 1], restockAt: 2, carton: 6 },
  { name: 'GT X ESSENTIAL 15W-40 4L', price: 23000, cost: 19900, stock: 18, daily: [0, 2], restockAt: 5, carton: 12 },
  { name: 'GT X ESSENTIAL 15W-40 5L', price: 28500, cost: 24700, stock: 12, daily: [0, 1], restockAt: 3, carton: 8 },
  { name: 'POWER MAX HD-40 (RETAIL OIL)', price: 3200, cost: 2500, stock: 60, daily: [2, 8], restockAt: 15, carton: 48 },
  { name: 'ATF DEX II', price: 7500, cost: 6100, stock: 20, daily: [0, 2], restockAt: 5, carton: 12 },
]
lubes.forEach((l, i) => {
  l.id = uuid(`lube:${l.name}`)
  add('station_lube_products', {
    id: l.id, org_id: STATION, product_name: l.name, unit_price: l.price, sort_order: i,
    created_at: created, opening_stock: l.stock, opening_date: START,
  })
})

/**
 * Accounts (the Account Ledger). A balance above zero is owed TO the station, below zero is owed
 * BY it: a debit (sales_amount) moves it up, a credit (amount_paid) moves it down.
 *
 *   debtor    buys fuel on credit and pays some of it off: ends owing the station
 *   prepaid   paid a deposit up front and draws fuel against it: the station owes them
 *   supplier  delivers on credit and the station pays them down: the station owes them
 */
const customers = [
  { kind: 'debtor', name: 'Lekki Logistics Ltd', phone: '08091110001', opening: 450000, buys: [80000, 220000], pays: 0.12 },
  { kind: 'debtor', name: 'Ajah Haulage Co.', phone: '08091110003', opening: 125000, buys: [90000, 300000], pays: 0.1 },
  { kind: 'debtor', name: 'Chevron Estate Shuttle', phone: '08091110002', opening: 0, buys: [40000, 120000], pays: 0.2 },
  { kind: 'debtor', name: 'Mrs. Adeyemi (Generator)', phone: '08091110004', opening: 38000, buys: [15000, 45000], pays: 0.08 },
  { kind: 'prepaid', name: 'Dangote Fleet Services (Prepaid)', phone: '08091110005', opening: -2500000, buys: [120000, 260000], topUp: 1500000 },
  { kind: 'prepaid', name: 'Lagos State Ministry Pool (Prepaid)', phone: '08091110006', opening: -900000, buys: [30000, 90000], topUp: 600000 },
  { kind: 'supplier', name: 'Mega Lubes Distributors', phone: '08091110009', opening: -480000, supply: [150000, 320000] },
  { kind: 'supplier', name: 'Bright Generators & Repairs', phone: '08091110010', opening: -95000, supply: [25000, 70000] },
]
customers.forEach((c, i) => {
  c.id = uuid(`customer:${c.name}`)
  c.balance = c.opening
  add('station_customers', {
    id: c.id, org_id: STATION, name: c.name, phone: c.phone, opening_balance: c.opening,
    opening_date: START, sort_order: i, created_at: created, station_value_tracked: false,
  })
})
const SUPPLIER = customers.find((c) => c.name === 'Mega Lubes Distributors').id

// The fixed consumption and pour-back accounts every station gets at onboarding (lib/defaultAccounts.js).
const DEFAULT_ACCOUNTS = [
  'Police', 'Manager Car', 'DSS OFFICIALS', 'Army', 'EDSTMA', 'Weight and Measures', 'Vigilante',
  'Security Agents', 'Regional Manager Car', 'Area Manager Car', 'LOGISTICS', 'Pour Back After Pump Repairs',
  'Generator', 'MDS Logistics Truck', 'Logistics Truck', 'Police/Army', 'DPR', 'Others', 'Pour Back',
]
const defaultAccount = Object.fromEntries(DEFAULT_ACCOUNTS.map((name, i) => {
  const id = uuid(`default-account:${name}`)
  add('station_customers', {
    id, org_id: STATION, name, phone: 'DEFAULT', opening_balance: 0, opening_date: START,
    sort_order: 1000 + i, created_at: created, station_value_tracked: false,
  })
  return [name, id]
}))
const CONSUMERS = ['Generator', 'Manager Car', 'Police', 'LOGISTICS', 'Area Manager Car']

// ── Trading days ─────────────────────────────────────────────────────────────

const entry = (table, date, fields, by = OWNER) => add(table, {
  id: uuid(`${table}:${(tables[table] || []).length}`),
  org_id: STATION, entry_date: date, ...fields,
  created_by: by, created_at: at(date, 20), updated_at: at(date, 20), deleted_at: null, updated_by: null,
})

const meters = Object.fromEntries(nozzles.map((n) => [n.id, n.meter]))
const stock = Object.fromEntries(tanks.map((t) => [t.id, t.opening]))
const lubeStock = Object.fromEntries(lubes.map((l) => [l.id, l.stock]))
const depots = ['NIPCO Depot, Apapa', 'Mainland Depot, Ijora', 'Ibafo Depot']
const drivers = ['Musa Ibrahim', 'Chinedu Eze', 'Ade Olaniyan', 'Sani Bello']
let waybill = 40210

// Prices move once, mid-period, as they do.
const priceOn = (offset) => (offset < -DAYS / 2
  ? { PMS: 865, AGO: 1050, DPK: 1250 }
  : { PMS: 897, AGO: 1080, DPK: 1250 })

function deliver(date, tank, by) {
  const ordered = tank.fuel === 'DPK' ? 15000 : 33000
  const compartments = tank.fuel === 'DPK' ? [7500, 7500, 0] : [11000, 11000, 11000]
  const actual = ordered - between(20, 140)
  const depotHeight = between(1350, 1420)
  stock[tank.id] += actual
  const wb = waybill++
  entry('product_receipt_entries', date, {
    loaded_date: date, driver_name: pick(drivers), waybill_number: `WB-${wb}`, ticket_number: `TK-${wb + 7000}`,
    truck_number: `LSD ${between(100, 999)} ${pick(['XA', 'KJA', 'EKY', 'APP'])}`,
    chart_ullage: between(20, 60), chart_liquid_height: depotHeight, depot_ullage: between(20, 60), depot_liquid_height: depotHeight,
    station_ullage: between(25, 70), station_liquid_height: depotHeight - between(2, 12),
    first_compartment: compartments[0], second_compartment: compartments[1], third_compartment: compartments[2],
    actual_volume: actual, depot_name: pick(depots), notes: null, tank_id: tank.id,
    arrival_time: `${String(between(6, 10)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`,
    exit_time: `${String(between(11, 14)).padStart(2, '0')}:${String(between(0, 59)).padStart(2, '0')}`,
    ...Object.fromEntries([1, 2, 3].flatMap((k) => compartments[k - 1] ? [
      [`chart_high_ullage_${k}`, between(15, 30)], [`chart_low_ullage_${k}`, between(30, 55)],
      [`chart_liquid_height_${k}`, depotHeight], [`depot_ullage_${k}`, between(20, 50)],
      [`depot_liquid_height_${k}`, depotHeight], [`station_ullage_${k}`, between(25, 60)],
      [`station_liquid_height_${k}`, depotHeight - between(2, 12)],
      [`high_vol_${k}`, compartments[k - 1] + between(0, 40)], [`low_vol_${k}`, compartments[k - 1] - between(0, 40)],
    ] : [])),
  }, by)
}

for (let offset = -DAYS + 1; offset <= -1; offset++) {
  const date = day(offset)
  const prices = priceOn(offset)
  const by = offset % 3 === 0 ? STAFF : OWNER

  // A truck comes when a tank runs low: before the day's sales, as at most stations.
  for (const t of tanks) {
    const reorder = t.fuel === 'DPK' ? 4000 : 9000
    if (stock[t.id] < reorder) deliver(date, t, by)
  }

  // Pumps: meters climb by what each nozzle sold; tanks fall by it.
  let salesValue = 0
  const readings = nozzles.map((n) => {
    const tank = tankByKey[n.tank]
    const sold = Math.min(between(...n.sells), Math.max(0, stock[tank.id] - 300))
    const consumption = n.fuel === 'PMS' && random() < 0.15 ? between(10, 40) : 0
    const pourBack = random() < 0.08 ? between(5, 20) : 0
    meters[n.id] += sold
    stock[tank.id] -= sold - pourBack
    salesValue += (sold - consumption - pourBack) * prices[n.fuel]
    return {
      pump_id: n.id, nozzle_label: n.label, fuel_type: n.fuel, closing_meter: meters[n.id], consumption, pour_back: pourBack,
      consumption_customer_id: consumption ? defaultAccount[pick(CONSUMERS)] : null,
      pour_back_customer_id: pourBack ? defaultAccount[pick(['Pour Back', 'Pour Back After Pump Repairs'])] : null,
    }
  })
  const tankReadings = tanks.map((t) => {
    // The dip is never exact: a few litres either way.
    stock[t.id] = Math.max(0, stock[t.id] + between(-25, 25))
    return { tank_id: t.id, tank_label: t.label, closing_stock: stock[t.id] }
  })
  entry('daily_sales_entries', date, {
    nozzle_readings: readings, tank_readings: tankReadings,
    ugt_closing_stock: tankReadings.reduce((s, t) => s + t.closing_stock, 0),
    prices, notes: offset % 7 === 0 ? 'Generator ran 3 hours (power outage)' : null, close_of_business: true,
  }, by)

  // Money: the day's takings split across the banks; the cash goes in the next morning.
  let left = Math.round(salesValue - between(0, 4000))
  banks.forEach((b, i) => {
    const amount = i === banks.length - 1 ? left : Math.round(salesValue * b.share * (0.9 + random() * 0.2))
    left -= amount
    entry('lodgement_entries', b.type === 'bank_deposit' ? day(offset + 1) : date, {
      amount, lodgement_type: b.type, sales_date: date, notes: null, bank_id: b.id,
    }, by)
  })

  // Lubes: each product sells its usual few a day, never more than is on the shelf; a carton
  // comes in from the distributor once one runs down to its reorder level.
  for (const l of lubes) {
    const units = Math.min(between(...l.daily), lubeStock[l.id])
    if (units <= 0) continue
    lubeStock[l.id] -= units
    entry('lube_sales_entries', date, {
      unit_sold: units, unit_received: 0, price: l.price, notes: null, product_id: l.id,
      customer_id: null, supplier_id: null, invoice_no: null, unit_cost: null,
    }, by)
  }
  for (const l of lubes) {
    if (lubeStock[l.id] > l.restockAt) continue
    const units = l.carton * between(1, 2)
    lubeStock[l.id] += units
    entry('lube_sales_entries', date, {
      unit_sold: 0, unit_received: units, price: l.price, notes: 'Restock', product_id: l.id,
      customer_id: null, supplier_id: SUPPLIER, invoice_no: `INV-${between(1000, 9999)}`, unit_cost: l.cost,
    }, by)
  }
  if (offset % 7 === 0) {
    for (const l of lubes) entry('lube_stock_entries', date, { stock: lubeStock[l.id], notes: 'Weekly count', product_id: l.id }, by)
  }

  // Accounts. Debit (sales_amount) raises what the account owes the station; credit
  // (amount_paid) lowers it. Each kind is kept on its own side of zero.
  const debit = (c, amount, notes) => { c.balance += amount; entry('customer_payment_entries', date, { amount_paid: 0, sales_amount: amount, notes, customer_id: c.id }, by) }
  const credit = (c, amount, notes) => { c.balance -= amount; entry('customer_payment_entries', date, { amount_paid: amount, sales_amount: 0, notes, customer_id: c.id }, by) }
  for (const c of customers) {
    if (c.kind === 'debtor') {
      if (random() < 0.35) debit(c, between(...c.buys), 'Fuel on credit')
      // They pay part of what they owe, never all of it, so they stay in debt.
      if (c.balance > 0 && random() < c.pays) credit(c, Math.round(c.balance * (0.3 + random() * 0.4) / 1000) * 1000, 'Transfer received')
    } else if (c.kind === 'prepaid') {
      const drawn = Math.min(between(...c.buys), Math.max(0, -c.balance - 50000))
      if (drawn > 0 && random() < 0.4) debit(c, drawn, 'Fuel drawn against deposit')
      // Topped up when the deposit runs low, so the station always holds their money.
      if (-c.balance < c.topUp / 3) credit(c, c.topUp, 'Deposit top-up (transfer)')
    } else {
      // Suppliers: a credit is a delivery the station has not paid for yet; a debit pays it down.
      if (random() < 0.12) credit(c, between(...c.supply), c.name.startsWith('Mega') ? 'Lube supply on credit' : 'Generator servicing on credit')
      if (-c.balance > 100000 && random() < 0.1) debit(c, Math.round(-c.balance * (0.3 + random() * 0.3) / 1000) * 1000, 'Payment to supplier')
    }
  }
  // Now and then a debtor takes lubes on account too (lib/accountBalance.js counts these).
  if (random() < 0.25) {
    const c = pick(customers.filter((x) => x.kind === 'debtor'))
    const l = pick(lubes)
    if (lubeStock[l.id] > 2) {
      lubeStock[l.id] -= 2
      c.balance += 2 * l.price
      entry('lube_sales_entries', date, {
        unit_sold: 2, unit_received: 0, price: l.price, notes: 'On account', product_id: l.id,
        customer_id: c.id, supplier_id: null, invoice_no: null, unit_cost: null,
      }, by)
    }
  }
}

// ── Imprest (petty cash) for this month ──────────────────────────────────────

const PERIOD = uuid('imprest:current')
add('imprest_periods', {
  id: PERIOD, org_id: STATION, month: today.getUTCMonth() + 1, year: today.getUTCFullYear(), imprest_amount: 250000,
  custodian_name: 'Amaka Obi', form_number: 'IMP-001', notes: null, created_by: OWNER,
  created_at: at(day(-today.getUTCDate() + 1), 9), updated_at: at(day(-today.getUTCDate() + 1), 9),
})
const expenses = [
  ['Generator diesel top-up', 'NEPA backup', 'ACC-401', 38000],
  ['Forecourt cleaning materials', 'Cleaner', 'ACC-310', 12500],
  ['Pump nozzle repair', 'Technician', 'ACC-520', 45000],
  ['Staff lunch (stock count)', 'Staff', 'ACC-205', 18000],
  ['Receipt books printing', 'Printer', 'ACC-115', 9500],
]
expenses.forEach(([details, beneficiary, code, amount], i) => {
  // Spread through this month so far, never later than yesterday.
  const date = day(Math.min(-1, -(today.getUTCDate() - 1) + i * 4))
  add('imprest_entries', {
    id: uuid(`imprest-entry:${i}`), org_id: STATION, imprest_period_id: PERIOD, entry_date: date,
    beneficiary, transaction_details: details, amount, account_code: code, pcv_number: `PCV-${String(i + 1).padStart(3, '0')}`,
    receipt_image_url: null, created_by: OWNER, created_at: at(date, 15), updated_at: at(date, 15), deleted_at: null, updated_by: null,
  })
})

add('station_messages', {
  id: uuid('message:welcome'), org_id: STATION, user_id: OWNER, user_name: 'Tunde Bakare', type: 'activity',
  content: 'seeded the test station', action_type: 'created_entry', deleted_at: null, created_at: at(day(-1), 21),
})

// ── Write ────────────────────────────────────────────────────────────────────

rmSync(DATA, { recursive: true, force: true })
mkdirSync(DATA, { recursive: true })
for (const [table, rows] of Object.entries(tables)) writeFileSync(join(DATA, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`)

const counts = Object.entries(tables).map(([t, rows]) => `  ${t.padEnd(26)} ${rows.length}`).join('\n')
console.log(`Seeded ${DATA} (${START} to ${day(-1)}):\n${counts}\n\nSign in with owner@test.local, staff@test.local or admin@test.local, password "${PASSWORD}".`)
