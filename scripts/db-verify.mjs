/**
 * Database verification and admin bootstrap.
 *
 *   node --env-file=.env.local scripts/db-verify.mjs
 *   node --env-file=.env.local scripts/db-verify.mjs --grant-admin you@example.com
 *
 * Checks that the schema landed correctly, that Row Level Security is actually
 * shutting the anonymous key out, and that the seed rows exist. With
 * --grant-admin it also adds a confirmed auth user to the admin allow-list.
 *
 * Read-only unless --grant-admin is passed.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey || !anonKey) {
  console.error('Missing Supabase environment variables. Run with --env-file=.env.local')
  process.exit(1)
}

const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }
const anon = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }

let passed = 0
let failed = 0

function ok(label, detail = '') {
  passed += 1
  console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  ${detail}` : ''}`)
}

function bad(label, detail = '') {
  failed += 1
  console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `  ${detail}` : ''}`)
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

const TABLES = ['products', 'orders', 'abandoned_checkouts', 'settings', 'ad_spend', 'admin_users']
const REPORTS = ['report_financials', 'report_funnel', 'report_daily', 'report_sources', 'report_ad_spend', 'report_leads']

/* -------------------------------------------------------------------------- */

section('1. Tables')

const present = new Set()

for (const table of TABLES) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { ...svc, Prefer: 'count=exact' },
  })
  if (res.ok) {
    present.add(table)
    const count = (res.headers.get('content-range') ?? '').split('/')[1] ?? '?'
    ok(table.padEnd(20), `${count} rows`)
  } else {
    bad(table.padEnd(20), `HTTP ${res.status}`)
  }
}

if (present.size === 0) {
  console.log(
    '\n\x1b[33mThe schema has not been created yet.\x1b[0m\n' +
      'Open the Supabase dashboard → SQL Editor → New query, paste all of\n' +
      'supabase/setup.sql, and press Run. Then re-run this script.\n',
  )
  process.exit(1)
}

/* -------------------------------------------------------------------------- */

section('2. Reporting functions')

for (const fn of REPORTS) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: svc,
    body: JSON.stringify({ from_ts: '2020-01-01T00:00:00Z', to_ts: '2030-01-01T00:00:00Z' }),
  })
  if (res.ok) ok(fn.padEnd(20))
  else bad(fn.padEnd(20), `HTTP ${res.status} ${(await res.text()).slice(0, 70)}`)
}

for (const fn of ['next_order_number', 'is_admin']) {
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: svc, body: '{}' })
  if (res.ok) ok(fn.padEnd(20), fn === 'next_order_number' ? `sample: ${await res.text()}` : '')
  else bad(fn.padEnd(20), `HTTP ${res.status}`)
}

/* -------------------------------------------------------------------------- */

section('3. Row Level Security (the anon key must see nothing)')

for (const table of TABLES) {
  // A missing table would 404 for anon too, which proves nothing about RLS.
  if (!present.has(table)) continue

  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=5`, { headers: anon })
  if (!res.ok) {
    ok(`${table} read blocked`.padEnd(30), `HTTP ${res.status}`)
    continue
  }
  const rows = await res.json()
  if (Array.isArray(rows) && rows.length === 0) {
    ok(`${table} read returns nothing`.padEnd(30))
  } else {
    bad(`${table} LEAKS DATA to anon`.padEnd(30), `${rows.length} rows visible`)
  }
}

// An anonymous write must be refused outright.
if (present.has('orders')) {
const write = await fetch(`${url}/rest/v1/orders`, {
  method: 'POST',
  headers: anon,
  body: JSON.stringify({
    order_number: 'RLS-PROBE',
    customer_name: 'probe',
    phone: '0600000000',
    address: 'probe',
    unit_price: '0.01',
    total_amount: '0.01',
  }),
})
if (write.ok) bad('anon can INSERT orders', 'RLS is not protecting writes')
else ok('anon INSERT refused'.padEnd(30), `HTTP ${write.status}`)
}

/* -------------------------------------------------------------------------- */

section('4. Seed data')

const productRes = await fetch(`${url}/rest/v1/products?select=*`, { headers: svc })
if (productRes.ok) {
  const products = await productRes.json()
  if (products.length === 0) {
    bad('product row', 'none found — run 0002_seed.sql')
  } else {
    for (const p of products) {
      const price = Number(p.price)
      const costs = Number(p.product_cost) + Number(p.transport_cost) + Number(p.other_cost)
      const margin = price + Number(p.shipping_price) - costs
      ok('product', `${p.slug} — ${p.price} ${'MAD'}, margin for ads ${margin.toFixed(2)}`)
      if (margin <= 0) bad('unit economics', 'costs meet or exceed the selling price')
    }
  }
} else {
  bad('product row', `HTTP ${productRes.status}`)
}

const settingsRes = await fetch(`${url}/rest/v1/settings?select=*`, { headers: svc })
if (settingsRes.ok) {
  const [settings] = await settingsRes.json()
  if (settings) ok('settings row', `mode=${settings.ad_cost_mode}, cpa=${settings.default_cpa}, currency=${settings.currency}`)
  else bad('settings row', 'missing')
} else {
  bad('settings row', `HTTP ${settingsRes.status}`)
}

/* -------------------------------------------------------------------------- */

section('5. Admin allow-list')

const grantIndex = process.argv.indexOf('--grant-admin')
const grantEmail = grantIndex > -1 ? process.argv[grantIndex + 1] : null

const usersRes = await fetch(`${url}/auth/v1/admin/users?per_page=50`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
})
const { users = [] } = await usersRes.json()

if (grantEmail) {
  const user = users.find((u) => u.email?.toLowerCase() === grantEmail.toLowerCase())
  if (!user) {
    bad('grant admin', `no auth user with email ${grantEmail}`)
  } else if (!user.email_confirmed_at) {
    bad('grant admin', `${grantEmail} has not confirmed their email yet`)
  } else {
    const res = await fetch(`${url}/rest/v1/admin_users`, {
      method: 'POST',
      headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id: user.id, email: user.email }),
    })
    if (res.ok) ok('granted admin', grantEmail)
    else bad('grant admin', `HTTP ${res.status} ${(await res.text()).slice(0, 90)}`)
  }
}

const adminsRes = await fetch(`${url}/rest/v1/admin_users?select=id,email`, { headers: svc })
if (adminsRes.ok) {
  const admins = await adminsRes.json()
  if (admins.length === 0) {
    bad('admins configured', 'none — nobody can sign in to /admin')
  } else {
    ok('admins configured', admins.map((a) => a.email ?? a.id).join(', '))
  }
} else {
  bad('admins configured', `HTTP ${adminsRes.status}`)
}

/* -------------------------------------------------------------------------- */

console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m\n`)
process.exit(failed > 0 ? 1 : 0)
