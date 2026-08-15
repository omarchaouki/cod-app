import { NextResponse } from 'next/server'
import { z } from 'zod'
import { sendServerEvent } from '@/lib/analytics/server'
import { fromCentimes, multiplyCentimes, toCentimes } from '@/lib/money'
import { getClientIp, hashIp, rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { orderInputSchema } from '@/lib/validation'
import type { Product } from '@/lib/db/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Per-IP ceiling. Generous for a family sharing a connection, hostile to bots. */
const IP_LIMIT = 8
const IP_WINDOW_MS = 10 * 60 * 1000

/** A second order from the same phone inside this window is a double-tap. */
const DUPLICATE_WINDOW_MINUTES = 10

function badRequest(error: string, fields?: Record<string, string>, status = 400) {
  return NextResponse.json({ ok: false, error, fields }, { status })
}

export async function POST(request: Request) {
  /* ------------------------------ rate limit ----------------------------- */
  const ip = getClientIp(request.headers)
  const limit = rateLimit(`order:${ip}`, IP_LIMIT, IP_WINDOW_MS)

  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'عدد كبير من المحاولات. المرجو الانتظار قليلاً ثم إعادة المحاولة.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    )
  }

  /* ------------------------------ parse body ----------------------------- */
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return badRequest('طلب غير صالح.')
  }

  const parsed = orderInputSchema
    .extend({ event_id: z.string().trim().max(120).optional() })
    .safeParse(raw)

  if (!parsed.success) {
    // Honeypot rejections are reported as a generic error so a bot learns
    // nothing about why it failed.
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      if (key === 'company') return badRequest('تعذّر إرسال الطلب.')
      if (!fields[key]) fields[key] = issue.message
    }
    return badRequest('المرجو التحقق من المعلومات المدخلة.', fields)
  }

  const input = parsed.data
  const supabase = createAdminClient()

  /* ------------------------- idempotency (fast path) --------------------- */
  // A retry of a request that already succeeded returns the original order
  // rather than creating a second one.
  const { data: existing } = await supabase
    .from('orders')
    .select('order_number')
    .eq('idempotency_key', input.idempotency_key)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, order_number: existing.order_number, duplicate: true })
  }

  /* ------------------------ server-side pricing -------------------------- */
  // The browser sent no prices and none would have been trusted. Everything
  // financial is read from the database here.
  const productQuery = supabase.from('products').select('*').eq('is_active', true)
  const { data: productRow, error: productError } = input.product_slug
    ? await productQuery.eq('slug', input.product_slug).maybeSingle()
    : await productQuery.order('created_at', { ascending: true }).limit(1).maybeSingle()

  if (productError || !productRow) {
    console.error('[orders] product lookup failed', productError?.message)
    return badRequest('المنتج غير متوفر حالياً.', undefined, 503)
  }

  const product = productRow as Product

  const quantity = input.quantity
  const unitPrice = toCentimes(product.price)
  const shippingCharged = toCentimes(product.shipping_price)
  const totalAmount = multiplyCentimes(unitPrice, quantity) + shippingCharged

  // Cost snapshot, so later edits to the catalogue never rewrite the profit of
  // orders that were already placed.
  const productCost = multiplyCentimes(toCentimes(product.product_cost), quantity)
  const shippingCost = toCentimes(product.transport_cost)
  const otherCost = toCentimes(product.other_cost)

  /* --------------------- duplicate submission guard ---------------------- */
  const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString()
  const { data: recent } = await supabase
    .from('orders')
    .select('order_number')
    .eq('phone', input.phone)
    .gte('created_at', duplicateSince)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recent) {
    // Treated as success: the customer's order does exist, and telling them it
    // failed would only make them submit a third time.
    return NextResponse.json({ ok: true, order_number: recent.order_number, duplicate: true })
  }

  /* --------------------------- order number ------------------------------ */
  const { data: orderNumber, error: numberError } = await supabase.rpc('next_order_number')

  if (numberError || !orderNumber) {
    console.error('[orders] could not generate an order number', numberError?.message)
    return badRequest('تعذّر إنشاء الطلب. المرجو المحاولة مرة أخرى.', undefined, 500)
  }

  /* ------------------------------ attribution ---------------------------- */
  const attribution = input.attribution ?? {}
  const eventId = input.event_id ?? `lead_${input.idempotency_key}`

  /* -------------------------- link the lead ------------------------------ */
  // If this visitor was already captured as an abandoned checkout, the order
  // is attached to that lead instead of leaving a stale duplicate behind.
  const { data: lead } = await supabase
    .from('abandoned_checkouts')
    .select('id')
    .or(`session_id.eq.${input.session_id},phone.eq.${input.phone}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  /* ------------------------------ insert --------------------------------- */
  const { data: order, error: insertError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber as string,
      customer_name: input.customer_name,
      phone: input.phone,
      address: input.address,
      product_id: product.id,
      quantity,
      unit_price: fromCentimes(unitPrice),
      shipping_charged: fromCentimes(shippingCharged),
      total_amount: fromCentimes(totalAmount),
      product_cost: fromCentimes(productCost),
      shipping_cost: fromCentimes(shippingCost),
      other_cost: fromCentimes(otherCost),
      // Advertising cost is attributed later, from the profitability settings
      // or a per-order figure entered by the admin.
      acquisition_cost: '0.00',
      status: 'NEW',
      source: attribution.source ?? 'direct',
      utm_source: attribution.utm_source ?? null,
      utm_medium: attribution.utm_medium ?? null,
      utm_campaign: attribution.utm_campaign ?? null,
      utm_content: attribution.utm_content ?? null,
      utm_term: attribution.utm_term ?? null,
      fbclid: attribution.fbclid ?? null,
      ttclid: attribution.ttclid ?? null,
      landing_url: attribution.landing_url ?? null,
      referrer: attribution.referrer ?? null,
      session_id: input.session_id,
      lead_id: lead?.id ?? null,
      idempotency_key: input.idempotency_key,
      ip_hash: hashIp(ip),
      user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
      event_id: eventId,
    })
    .select('id, order_number')
    .single()

  if (insertError) {
    // A unique-violation means a concurrent request won the race; return that
    // order rather than an error.
    if (insertError.code === '23505') {
      const { data: raced } = await supabase
        .from('orders')
        .select('order_number')
        .eq('idempotency_key', input.idempotency_key)
        .maybeSingle()
      if (raced) {
        return NextResponse.json({ ok: true, order_number: raced.order_number, duplicate: true })
      }
    }
    console.error('[orders] insert failed', insertError.message)
    return badRequest('تعذّر تسجيل الطلب. المرجو المحاولة مرة أخرى.', undefined, 500)
  }

  /* ------------------- convert the abandoned checkout -------------------- */
  if (lead?.id) {
    const { error: leadError } = await supabase
      .from('abandoned_checkouts')
      .update({ status: 'CONVERTED', converted_order_id: order.id })
      .eq('id', lead.id)

    if (leadError) console.error('[orders] lead conversion failed', leadError.message)
  }

  /* ---------------------------- server event ----------------------------- */
  /* `Lead`, never `Purchase`. The customer has not paid yet — with cash on
     delivery the sale is only real once the money is collected, and that event
     is sent from the admin when the order is marked PAID. */
  await sendServerEvent({
    eventName: 'Lead',
    eventId,
    value: totalAmount / 100,
    currency: 'MAD',
    contentId: product.slug,
    contentName: product.name,
    quantity,
    customer: { name: input.customer_name, phone: input.phone },
    context: {
      clientIp: ip === 'unknown' ? null : ip,
      userAgent: request.headers.get('user-agent'),
      sourceUrl: attribution.landing_url ?? null,
      fbclid: attribution.fbclid ?? null,
      ttclid: attribution.ttclid ?? null,
    },
  })

  return NextResponse.json({ ok: true, order_number: order.order_number })
}
