import type { AnalyticsEvent, AnalyticsProvider } from './types'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

/**
 * Meta maps our vocabulary onto its standard events. `Lead` is deliberately
 * what a submitted COD form fires — a cash-on-delivery order is a lead until
 * the money is actually collected. `Purchase` is only sent later, server-side,
 * when the order is marked PAID in the admin.
 */
const EVENT_MAP: Record<AnalyticsEvent, string> = {
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  InitiateCheckout: 'InitiateCheckout',
  AddPaymentInfo: 'AddPaymentInfo',
  Lead: 'Lead',
  Purchase: 'Purchase',
}

export const metaProvider: AnalyticsProvider = {
  name: 'meta',

  isEnabled() {
    return (
      typeof window !== 'undefined' &&
      typeof window.fbq === 'function' &&
      Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID)
    )
  },

  track(event, payload) {
    if (!this.isEnabled()) return

    const data: Record<string, unknown> = {}
    if (payload.value !== undefined) data.value = payload.value
    if (payload.currency) data.currency = payload.currency
    if (payload.contentIds) data.content_ids = payload.contentIds
    if (payload.contentName) data.content_name = payload.contentName
    if (payload.contentType) data.content_type = payload.contentType
    if (payload.quantity !== undefined) data.num_items = payload.quantity

    const options = payload.eventId ? { eventID: payload.eventId } : undefined

    window.fbq?.('track', EVENT_MAP[event], data, options)
  },
}

export function metaPixelScript(pixelId: string): string {
  return `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`
}
