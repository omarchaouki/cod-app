/**
 * End-to-end flow test against the live Supabase project.
 * Creates test rows, asserts behaviour, then deletes everything it created.
 */

const BASE = 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}`, 'Content-Type': 'application/json' }

if (!process.argv.includes('--confirm')) {
  console.error(
    [
      '',
      'This script CREATES AND DELETES rows in the database .env.local points at.',
      'Everything it touches is scoped to the test phone, but re-run with --confirm',
      'to acknowledge that it writes to a live project.',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

const TEST_PHONE = '0699887766'
const SESSION = 'e2etest-' + Math.random().toString(36).slice(2, 10)

let pass = 0, fail = 0
const check = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? '  ' + detail : ''}`) }
  else { fail++; console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? '  ' + detail : ''}`) }
}
const db = async (path, opts = {}) => {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: svc, ...opts })
  const text = await r.text()
  return { status: r.status, body: text ? JSON.parse(text) : null }
}
const rpc = async (fn, args) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: svc, body: JSON.stringify(args) })
  const j = await r.json()
  return Array.isArray(j) ? j[0] : j
}
const RANGE = { from_ts: '2020-01-01T00:00:00Z', to_ts: '2030-01-01T00:00:00Z' }

/* -------------------------------------------------------------- cleanup up-front */
await db(`orders?phone=eq.${TEST_PHONE}`, { method: 'DELETE' })
await db(`abandoned_checkouts?phone=eq.${TEST_PHONE}`, { method: 'DELETE' })

const { body: productRows } = await db('products?select=*&is_active=eq.true&limit=1')
const P = productRows[0]
const EXPECT = {
  unit: Number(P.price),
  ship: Number(P.shipping_price),
  total: Number(P.price) + Number(P.shipping_price),
  productCost: Number(P.product_cost),
  transport: Number(P.transport_cost),
  other: Number(P.other_cost),
}
EXPECT.profit = EXPECT.total - EXPECT.productCost - EXPECT.transport - EXPECT.other
console.log(`
Live catalogue  price=${EXPECT.unit} ship=${EXPECT.ship} costs=${EXPECT.productCost}/${EXPECT.transport}/${EXPECT.other} -> expected profit ${EXPECT.profit}`)

const before = await rpc('report_financials', RANGE)
console.log(`\n\x1b[1mBaseline\x1b[0m  paid orders=${before.paid_orders}  paid revenue=${before.paid_revenue}\n`)

/* -------------------------------------------------------------- 1. abandoned checkout */
console.log('\x1b[1m1. Abandoned checkout capture\x1b[0m')

const attribution = {
  source: 'tiktok', utm_source: 'tiktok', utm_medium: 'cpc', utm_campaign: 'rentree-2026',
  utm_content: 'video-b', utm_term: null, fbclid: null, ttclid: 'TT_CLICK_E2E',
  landing_url: 'http://localhost:3000/?utm_source=tiktok', referrer: null,
}

let r = await fetch(`${BASE}/api/leads`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ full_name: 'اختبار المعلم', phone: TEST_PHONE, address: null, product_slug: 'pack-cahiers-eps-2026-2027', session_id: SESSION, attribution }),
})
check('lead endpoint accepts a valid phone', r.ok)

let { body: leads } = await db(`abandoned_checkouts?phone=eq.${TEST_PHONE}&select=*`)
check('lead row created', leads.length === 1, `rows=${leads.length}`)
check('lead captured attribution', leads[0]?.utm_campaign === 'rentree-2026' && leads[0]?.ttclid === 'TT_CLICK_E2E')
check('lead starts as NEW', leads[0]?.status === 'NEW')

// Repeat calls with more data must UPDATE, not duplicate.
await fetch(`${BASE}/api/leads`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ full_name: 'اختبار المعلم', phone: TEST_PHONE, address: 'مراكش، حي المسيرة، زنقة 5 رقم 10', product_slug: 'pack-cahiers-eps-2026-2027', session_id: SESSION, attribution }),
})
;({ body: leads } = await db(`abandoned_checkouts?phone=eq.${TEST_PHONE}&select=*`))
check('repeat capture updates instead of duplicating', leads.length === 1, `rows=${leads.length}`)
check('address merged into the same lead', Boolean(leads[0]?.address))

const leadId = leads[0]?.id

/* -------------------------------------------------------------- 2. price tampering */
console.log('\n\x1b[1m2. Order submission (with a price-tampering attempt)\x1b[0m')

const idem = 'e2e_' + Math.random().toString(36).slice(2, 12)
r = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer_name: 'اختبار المعلم', phone: TEST_PHONE,
    address: 'مراكش، حي المسيرة، زنقة 5 رقم 10',
    quantity: 1, product_slug: 'pack-cahiers-eps-2026-2027',
    session_id: SESSION, idempotency_key: idem, attribution,
    // A hostile client trying to buy the pack for one centime:
    price: '0.01', unit_price: '0.01', total_amount: '0.01', product_cost: '0.00',
  }),
})
const orderRes = await r.json()
check('order created', r.ok && orderRes.ok, orderRes.order_number ?? JSON.stringify(orderRes).slice(0, 80))

let { body: orders } = await db(`orders?phone=eq.${TEST_PHONE}&select=*`)
const order = orders[0]
check('exactly one order row', orders.length === 1, `rows=${orders.length}`)
check('server ignored the injected price', Number(order?.total_amount) === EXPECT.total, `total=${order?.total_amount} expected=${EXPECT.total}`)
check('server used the catalogue unit price', Number(order?.unit_price) === EXPECT.unit, `unit=${order?.unit_price} expected=${EXPECT.unit}`)
check('server snapshotted real costs', Number(order?.product_cost) === EXPECT.productCost && Number(order?.shipping_cost) === EXPECT.transport, `product=${order?.product_cost} transport=${order?.shipping_cost}`)
check('order number generated', /^EPS-\d{4}-\d{5}$/.test(order?.order_number ?? ''), order?.order_number)
check('status starts at NEW', order?.status === 'NEW')
check('attribution attached to order', order?.utm_campaign === 'rentree-2026' && order?.ttclid === 'TT_CLICK_E2E')
check('IP stored only as a hash', Boolean(order?.ip_hash) && !String(order?.ip_hash).includes('.'), `len=${order?.ip_hash?.length}`)
check('generated profit column correct', Number(order?.profit) === EXPECT.profit, `profit=${order?.profit} expected=${EXPECT.profit}`)

/* -------------------------------------------------------------- 3. lead conversion */
console.log('\n\x1b[1m3. Lead conversion\x1b[0m')
;({ body: leads } = await db(`abandoned_checkouts?phone=eq.${TEST_PHONE}&select=*`))
check('lead marked CONVERTED', leads[0]?.status === 'CONVERTED', `status=${leads[0]?.status}`)
check('lead linked to the order', leads[0]?.converted_order_id === order?.id)
check('order links back to the lead', order?.lead_id === leadId)
check('no duplicate lead created', leads.length === 1, `rows=${leads.length}`)

/* -------------------------------------------------------------- 4. duplicate protection */
console.log('\n\x1b[1m4. Duplicate submission protection\x1b[0m')

r = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customer_name: 'اختبار المعلم', phone: TEST_PHONE, address: 'مراكش، حي المسيرة، زنقة 5 رقم 10', quantity: 1, product_slug: 'pack-cahiers-eps-2026-2027', session_id: SESSION, idempotency_key: idem, attribution }),
})
const retry = await r.json()
check('same idempotency key returns the original order', retry.order_number === order?.order_number && retry.duplicate === true)

r = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customer_name: 'اختبار المعلم', phone: TEST_PHONE, address: 'مراكش، حي المسيرة، زنقة 5 رقم 10', quantity: 1, product_slug: 'pack-cahiers-eps-2026-2027', session_id: SESSION, idempotency_key: 'e2e_different_key_1', attribution }),
})
const dup = await r.json()
;({ body: orders } = await db(`orders?phone=eq.${TEST_PHONE}&select=id`))
check('rapid re-submit did not create a second order', orders.length === 1, `rows=${orders.length}, duplicate=${dup.duplicate}`)

/* -------------------------------------------------------------- 5. THE REVENUE RULE */
console.log('\n\x1b[1m5. THE REVENUE RULE — only PAID counts\x1b[0m')

for (const status of ['NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED']) {
  await db(`orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  const fin = await rpc('report_financials', RANGE)
  const delta = Number(fin.paid_revenue) - Number(before.paid_revenue)
  check(`status ${status.padEnd(9)} contributes 0 revenue`, delta === 0, `revenue delta=${delta}`)
}

await db(`orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'PAID' }) })
const paidFin = await rpc('report_financials', RANGE)
const paidDelta = Number(paidFin.paid_revenue) - Number(before.paid_revenue)
check(`status PAID      contributes ${EXPECT.total}`, paidDelta === EXPECT.total, `revenue delta=${paidDelta}`)
check('paid order counted', Number(paidFin.paid_orders) === Number(before.paid_orders) + 1)

/* -------------------------------------------------------------- 6. timestamps + rollback */
console.log('\n\x1b[1m6. Status timestamps\x1b[0m')
;({ body: orders } = await db(`orders?id=eq.${order.id}&select=*`))
const paid = orders[0]
check('confirmed_at back-filled', Boolean(paid.confirmed_at))
check('shipped_at back-filled', Boolean(paid.shipped_at))
check('delivered_at back-filled', Boolean(paid.delivered_at))
check('paid_at set', Boolean(paid.paid_at))

// Rolling back out of PAID must remove the revenue again.
await db(`orders?id=eq.${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'RETURNED' }) })
const rolled = await rpc('report_financials', RANGE)
check('rollback out of PAID removes the revenue', Number(rolled.paid_revenue) === Number(before.paid_revenue), `revenue=${rolled.paid_revenue}`)
;({ body: orders } = await db(`orders?id=eq.${order.id}&select=paid_at,returned_at`))
check('paid_at cleared on rollback', orders[0].paid_at === null)
check('returned_at set', Boolean(orders[0].returned_at))

/* -------------------------------------------------------------- 7. funnel */
console.log('\n\x1b[1m7. Funnel counts from timestamps\x1b[0m')
const funnel = await rpc('report_funnel', RANGE)
check('funnel counts the test order as confirmed/shipped/delivered', Number(funnel.confirmed) >= 1 && Number(funnel.shipped) >= 1 && Number(funnel.delivered) >= 1, `confirmed=${funnel.confirmed} shipped=${funnel.shipped} delivered=${funnel.delivered}`)
check('funnel counts it as returned', Number(funnel.returned) >= 1, `returned=${funnel.returned}`)

/* -------------------------------------------------------------- 8. spam defences */
console.log('\n\x1b[1m8. Spam and validation defences\x1b[0m')

r = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customer_name: 'Bot', phone: '0611111111', address: 'somewhere in the city', quantity: 1, session_id: 'botsession01', idempotency_key: 'bot_key_0001', company: 'spam-corp' }),
})
check('honeypot rejected', !r.ok, `HTTP ${r.status}`)

r = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customer_name: 'اختبار', phone: '0512345678', address: 'مدينة وحي وعنوان مفصل', quantity: 1, session_id: 'badphone0001', idempotency_key: 'badphone_key1' }),
})
const badPhone = await r.json()
check('landline phone rejected', !r.ok && Boolean(badPhone.fields?.phone), badPhone.fields?.phone?.slice(0, 40))

r = await fetch(`${BASE}/api/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customer_name: 'اختبار المعلم', phone: '0612345699', address: 'قصير', quantity: 1, session_id: 'shortaddr001', idempotency_key: 'shortaddr_k1' }),
})
check('short address rejected', !r.ok, `HTTP ${r.status}`)

/* -------------------------------------------------------------- cleanup */
console.log('\n\x1b[1mCleanup\x1b[0m')
await db(`orders?phone=eq.${TEST_PHONE}`, { method: 'DELETE' })
await db(`abandoned_checkouts?phone=eq.${TEST_PHONE}`, { method: 'DELETE' })
const { body: leftOrders } = await db(`orders?phone=eq.${TEST_PHONE}&select=id`)
const { body: leftLeads } = await db(`abandoned_checkouts?phone=eq.${TEST_PHONE}&select=id`)
const after = await rpc('report_financials', RANGE)
check('test data removed', leftOrders.length === 0 && leftLeads.length === 0, `test orders=${leftOrders.length} test leads=${leftLeads.length}`)
const { body: survivors } = await db(`orders?phone=neq.${TEST_PHONE}&select=order_number`)
console.log(`  [90mreal orders left untouched: ${survivors.length}${survivors.length ? ' (' + survivors.map(o=>o.order_number).join(', ') + ')' : ''}[0m`)
check('revenue back to baseline', after.paid_revenue === before.paid_revenue, `revenue=${after.paid_revenue}`)

console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m\n`)
process.exit(fail > 0 ? 1 : 0)
