import 'server-only'

import { createHash } from 'node:crypto'

/**
 * Server-side conversion tracking (Meta Conversions API + TikTok Events API).
 *
 * Why this exists for a COD store:
 *
 *   A submitted cash-on-delivery form is *not* a sale. Roughly half of COD
 *   orders never get paid. Reporting every form submission as a Purchase
 *   teaches the ad platforms to optimise for people who order and then refuse
 *   the parcel.
 *
 *   So: submitting the form sends `Lead`. `Purchase` is sent from the admin,
 *   with the real collected amount, at the moment the order is marked PAID.
 *
 * Both calls carry the same `event_id` as the browser pixel so the platforms
 * deduplicate them into one event.
 */

const META_API_VERSION = 'v21.0'

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/** Meta requires a Moroccan number in E.164 without the leading `+`. */
function hashedPhone(phone: string): string | undefined {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return undefined
  const e164 = digits.startsWith('0') ? `212${digits.slice(1)}` : digits
  return sha256(e164)
}

function hashedName(fullName: string): { fn?: string; ln?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { fn: sha256(parts[0]) }
  return { fn: sha256(parts[0]), ln: sha256(parts.slice(1).join(' ')) }
}

export interface ServerEventInput {
  eventName: 'Lead' | 'Purchase'
  eventId: string
  eventTime?: number
  value?: number
  currency?: string
  contentId?: string
  contentName?: string
  quantity?: number
  customer: {
    name?: string | null
    phone?: string | null
  }
  context: {
    clientIp?: string | null
    userAgent?: string | null
    sourceUrl?: string | null
    fbclid?: string | null
    ttclid?: string | null
  }
}

interface DispatchResult {
  platform: string
  ok: boolean
  detail?: string
}

async function sendToMeta(input: ServerEventInput): Promise<DispatchResult | null> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_ACCESS_TOKEN
  if (!pixelId || !token) return null

  const { fn, ln } = hashedName(input.customer.name ?? '')
  const userData: Record<string, unknown> = {
    ph: hashedPhone(input.customer.phone ?? '') ? [hashedPhone(input.customer.phone ?? '')] : undefined,
    fn: fn ? [fn] : undefined,
    ln: ln ? [ln] : undefined,
    country: [sha256('ma')],
    client_ip_address: input.context.clientIp ?? undefined,
    client_user_agent: input.context.userAgent ?? undefined,
  }

  // fbc is the click id in the format Meta expects for attribution.
  if (input.context.fbclid) {
    userData.fbc = `fb.1.${Date.now()}.${input.context.fbclid}`
  }

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        event_source_url: input.context.sourceUrl ?? undefined,
        action_source: 'website',
        user_data: Object.fromEntries(
          Object.entries(userData).filter(([, v]) => v !== undefined),
        ),
        custom_data: {
          currency: input.currency ?? 'MAD',
          value: input.value,
          content_ids: input.contentId ? [input.contentId] : undefined,
          content_name: input.contentName,
          content_type: 'product',
          num_items: input.quantity,
        },
      },
    ],
  }

  if (process.env.META_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_TEST_EVENT_CODE
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    return { platform: 'meta', ok: false, detail: (await response.text()).slice(0, 300) }
  }
  return { platform: 'meta', ok: true }
}

async function sendToTikTok(input: ServerEventInput): Promise<DispatchResult | null> {
  const pixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID
  const token = process.env.TIKTOK_ACCESS_TOKEN
  if (!pixelId || !token) return null

  const eventName = input.eventName === 'Purchase' ? 'CompletePayment' : 'SubmitForm'

  const body = {
    event_source: 'web',
    event_source_id: pixelId,
    data: [
      {
        event: eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        user: Object.fromEntries(
          Object.entries({
            phone: hashedPhone(input.customer.phone ?? ''),
            ip: input.context.clientIp ?? undefined,
            user_agent: input.context.userAgent ?? undefined,
            ttclid: input.context.ttclid ?? undefined,
          }).filter(([, v]) => v !== undefined),
        ),
        page: { url: input.context.sourceUrl ?? undefined },
        properties: {
          currency: input.currency ?? 'MAD',
          value: input.value,
          contents: input.contentId
            ? [
                {
                  content_id: input.contentId,
                  content_name: input.contentName,
                  content_type: 'product',
                  quantity: input.quantity ?? 1,
                },
              ]
            : undefined,
        },
      },
    ],
  }

  const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Access-Token': token },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    return { platform: 'tiktok', ok: false, detail: (await response.text()).slice(0, 300) }
  }
  return { platform: 'tiktok', ok: true }
}

/**
 * Fire the event on every configured platform. Never throws and never blocks
 * the caller's own success path — an ad platform being down must not stop an
 * order from being created.
 */
export async function sendServerEvent(input: ServerEventInput): Promise<DispatchResult[]> {
  const settled = await Promise.allSettled([sendToMeta(input), sendToTikTok(input)])

  const results: DispatchResult[] = []
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled' && outcome.value) {
      results.push(outcome.value)
      if (!outcome.value.ok) {
        console.error(`[capi] ${outcome.value.platform} rejected the event`, outcome.value.detail)
      }
    } else if (outcome.status === 'rejected') {
      console.error('[capi] request failed', outcome.reason)
    }
  }
  return results
}
