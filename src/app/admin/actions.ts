'use server'

import { revalidatePath } from 'next/cache'
import { sendServerEvent } from '@/lib/analytics/server'
import { toCentimes } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'
import {
  adSpendSchema,
  leadStatusUpdateSchema,
  orderCostUpdateSchema,
  orderStatusUpdateSchema,
  productUpdateSchema,
  settingsUpdateSchema,
} from '@/lib/validation'
import type { Order } from '@/lib/db/types'

export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Every action re-checks the session and the admin allow-list on the server.
 * A server action is a public HTTP endpoint — it cannot inherit trust from the
 * page that rendered the form.
 */
async function authorize() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase: null, user: null, error: 'انتهت الجلسة. المرجو تسجيل الدخول.' }

  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (!isAdmin) return { supabase: null, user: null, error: 'غير مخوّل.' }

  return { supabase, user, error: null }
}

/* ========================================================================== *
 * Orders
 * ========================================================================== */

export async function updateOrderStatus(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authError } = await authorize()
  if (!supabase) return { ok: false, error: authError! }

  const parsed = orderStatusUpdateSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { ok: false, error: 'بيانات غير صحيحة.' }

  const { id, status } = parsed.data

  // Read the order first: marking it PAID has a side effect beyond the row.
  const { data: before, error: readError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (readError || !before) return { ok: false, error: 'الطلب غير موجود.' }

  const order = before as Order

  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  if (error) {
    console.error('[admin] status update failed', error.message)
    return { ok: false, error: 'تعذّر تحديث الحالة.' }
  }

  /* The COD conversion moment.
     Purchase is reported to the ad platforms here — when the money has
     actually been collected — and not when the form was submitted. The
     `purchase_event_sent_at` stamp makes it fire exactly once, even if the
     order is toggled out of PAID and back again. */
  if (status === 'PAID' && !order.purchase_event_sent_at) {
    const eventId = `purchase_${order.id}`

    const results = await sendServerEvent({
      eventName: 'Purchase',
      eventId,
      value: toCentimes(order.total_amount) / 100,
      currency: 'MAD',
      contentId: order.product_id ?? undefined,
      contentName: order.order_number,
      quantity: order.quantity,
      customer: { name: order.customer_name, phone: order.phone },
      context: {
        clientIp: null,
        userAgent: order.user_agent,
        sourceUrl: order.landing_url,
        fbclid: order.fbclid,
        ttclid: order.ttclid,
      },
    })

    /* Only record the event as sent if a platform actually accepted it.
       `sendServerEvent` returns an empty array when no Conversions API token
       is configured, and a failed result when a platform rejects the call.
       Stamping regardless would permanently mark orders paid *before* the
       pixels were set up as "already reported", so they would never send a
       Purchase once the tokens were added — a silent hole in the conversion
       data. Leaving the column null keeps them eligible for a later retry. */
    if (results.some((result) => result.ok)) {
      await supabase
        .from('orders')
        .update({ purchase_event_sent_at: new Date().toISOString() })
        .eq('id', id)
    }
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin/dashboard')
  revalidatePath('/admin/profitability')
  return { ok: true }
}

export async function updateOrderCosts(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authError } = await authorize()
  if (!supabase) return { ok: false, error: authError! }

  const parsed = orderCostUpdateSchema.safeParse({
    id: formData.get('id'),
    acquisition_cost: formData.get('acquisition_cost'),
    other_cost: formData.get('other_cost'),
    admin_note: formData.get('admin_note') || null,
  })
  if (!parsed.success) return { ok: false, error: 'قيم غير صحيحة.' }

  const { id, ...values } = parsed.data
  const { error } = await supabase.from('orders').update(values).eq('id', id)

  if (error) {
    console.error('[admin] cost update failed', error.message)
    return { ok: false, error: 'تعذّر حفظ التكاليف.' }
  }

  revalidatePath('/admin/orders')
  revalidatePath('/admin/profitability')
  return { ok: true }
}

/* ========================================================================== *
 * Abandoned checkouts
 * ========================================================================== */

export async function updateLeadStatus(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authError } = await authorize()
  if (!supabase) return { ok: false, error: authError! }

  const parsed = leadStatusUpdateSchema.safeParse({
    id: formData.get('id'),
    status: formData.get('status'),
  })
  if (!parsed.success) return { ok: false, error: 'بيانات غير صحيحة.' }

  const { error } = await supabase
    .from('abandoned_checkouts')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.id)

  if (error) {
    console.error('[admin] lead status update failed', error.message)
    return { ok: false, error: 'تعذّر تحديث الحالة.' }
  }

  revalidatePath('/admin/abandoned-checkouts')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

/* ========================================================================== *
 * Product
 * ========================================================================== */

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authError } = await authorize()
  if (!supabase) return { ok: false, error: authError! }

  const parsed = productUpdateSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    short_description: formData.get('short_description') || null,
    price: formData.get('price'),
    compare_at_price: formData.get('compare_at_price') || '',
    shipping_price: formData.get('shipping_price'),
    product_cost: formData.get('product_cost'),
    transport_cost: formData.get('transport_cost'),
    other_cost: formData.get('other_cost'),
    is_active: formData.get('is_active') === 'on',
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'قيم غير صحيحة.' }
  }

  const { id, compare_at_price, ...rest } = parsed.data

  const { error } = await supabase
    .from('products')
    .update({ ...rest, compare_at_price: compare_at_price ? compare_at_price : null })
    .eq('id', id)

  if (error) {
    console.error('[admin] product update failed', error.message)
    return { ok: false, error: 'تعذّر حفظ المنتج.' }
  }

  // The landing page caches the price for an hour; this pushes it out now.
  revalidatePath('/')
  revalidatePath('/admin/products')
  revalidatePath('/admin/profitability')
  return { ok: true }
}

/* ========================================================================== *
 * Settings and advertising spend
 * ========================================================================== */

export async function updateSettings(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authError } = await authorize()
  if (!supabase) return { ok: false, error: authError! }

  const parsed = settingsUpdateSchema.safeParse({
    ad_cost_mode: formData.get('ad_cost_mode'),
    default_cpa: formData.get('default_cpa'),
    store_name: formData.get('store_name'),
    store_phone: formData.get('store_phone') || null,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'قيم غير صحيحة.' }
  }

  const { error } = await supabase.from('settings').update(parsed.data).eq('id', true)

  if (error) {
    console.error('[admin] settings update failed', error.message)
    return { ok: false, error: 'تعذّر حفظ الإعدادات.' }
  }

  revalidatePath('/')
  revalidatePath('/admin/products')
  revalidatePath('/admin/profitability')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

export async function upsertAdSpend(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authError } = await authorize()
  if (!supabase) return { ok: false, error: authError! }

  const parsed = adSpendSchema.safeParse({
    spend_date: formData.get('spend_date'),
    platform: formData.get('platform'),
    amount: formData.get('amount'),
    note: formData.get('note') || null,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'قيم غير صحيحة.' }
  }

  // Re-entering the same day and platform corrects the figure instead of
  // double-counting the spend.
  const { error } = await supabase
    .from('ad_spend')
    .upsert(parsed.data, { onConflict: 'spend_date,platform' })

  if (error) {
    console.error('[admin] ad spend upsert failed', error.message)
    return { ok: false, error: 'تعذّر حفظ المصاريف.' }
  }

  revalidatePath('/admin/profitability')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}

export async function deleteAdSpend(formData: FormData): Promise<ActionResult> {
  const { supabase, error: authError } = await authorize()
  if (!supabase) return { ok: false, error: authError! }

  const id = String(formData.get('id') ?? '')
  if (!id) return { ok: false, error: 'معرّف غير صحيح.' }

  const { error } = await supabase.from('ad_spend').delete().eq('id', id)
  if (error) return { ok: false, error: 'تعذّر الحذف.' }

  revalidatePath('/admin/profitability')
  revalidatePath('/admin/dashboard')
  return { ok: true }
}
