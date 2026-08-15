import { NextResponse } from 'next/server'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { leadInputSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Abandoned checkout capture.
 *
 * Called while the visitor is still typing — a valid phone number is enough to
 * create the lead, because the people worth recovering are exactly the ones
 * who never reach the submit button.
 *
 * Deduplication is layered:
 *   1. `session_id` is unique, so one visitor produces one row no matter how
 *      many times the debounce fires.
 *   2. If that phone was already captured in another session, the newer row is
 *      folded into the existing one instead of creating a second lead.
 *   3. A lead that already converted into an order is never reopened.
 */

const IP_LIMIT = 40
const IP_WINDOW_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  const ip = getClientIp(request.headers)
  if (!rateLimit(`lead:${ip}`, IP_LIMIT, IP_WINDOW_MS).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const parsed = leadInputSchema.safeParse(raw)
  if (!parsed.success) {
    // Invalid partial input is normal here — the visitor is mid-typing.
    // Nothing is stored and nothing is reported as an error.
    return NextResponse.json({ ok: false }, { status: 200 })
  }

  const input = parsed.data
  const supabase = createAdminClient()

  const productQuery = supabase.from('products').select('id').eq('is_active', true)
  const { data: product } = input.product_slug
    ? await productQuery.eq('slug', input.product_slug).limit(1).maybeSingle()
    : await productQuery.order('created_at', { ascending: true }).limit(1).maybeSingle()

  const attribution = input.attribution ?? {}

  const payload = {
    session_id: input.session_id,
    full_name: input.full_name || null,
    phone: input.phone,
    address: input.address || null,
    product_id: product?.id ?? null,
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
    user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
  }

  /* ------------------- 1. same visitor, existing session ------------------ */
  const { data: bySession } = await supabase
    .from('abandoned_checkouts')
    .select('id, status')
    .eq('session_id', input.session_id)
    .maybeSingle()

  if (bySession) {
    // Never drag a converted lead back into the pipeline.
    if (bySession.status === 'CONVERTED') {
      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase
      .from('abandoned_checkouts')
      .update(payload)
      .eq('id', bySession.id)

    if (error) console.error('[leads] update by session failed', error.message)
    return NextResponse.json({ ok: true })
  }

  /* --------------- 2. same phone captured in another session -------------- */
  const { data: byPhone } = await supabase
    .from('abandoned_checkouts')
    .select('id, status')
    .eq('phone', input.phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (byPhone) {
    if (byPhone.status === 'CONVERTED') {
      return NextResponse.json({ ok: true })
    }

    // Keep the original row and move it onto the current session, so the
    // person appears once in the admin rather than once per device.
    const { error } = await supabase
      .from('abandoned_checkouts')
      .update(payload)
      .eq('id', byPhone.id)

    if (error) console.error('[leads] update by phone failed', error.message)
    return NextResponse.json({ ok: true })
  }

  /* ----------------------------- 3. new lead ------------------------------ */
  const { error } = await supabase.from('abandoned_checkouts').insert(payload)

  if (error && error.code !== '23505') {
    // 23505 means a concurrent request created the row first, which is fine.
    console.error('[leads] insert failed', error.message)
  }

  return NextResponse.json({ ok: true })
}
