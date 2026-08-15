import type { AnalyticsEvent, AnalyticsProvider } from './types'

declare global {
  interface Window {
    ttq?: {
      track: (event: string, params?: Record<string, unknown>, options?: Record<string, unknown>) => void
      page: () => void
      load: (id: string) => void
      instance?: (id: string) => unknown
    }
  }
}

/**
 * TikTok's event names differ from Meta's. Same reasoning applies: a submitted
 * COD form is `SubmitForm`, not `CompletePayment`. `CompletePayment` is only
 * sent server-side once the order is marked PAID.
 */
const EVENT_MAP: Record<AnalyticsEvent, string> = {
  PageView: 'Pageview',
  ViewContent: 'ViewContent',
  InitiateCheckout: 'InitiateCheckout',
  AddPaymentInfo: 'AddPaymentInfo',
  Lead: 'SubmitForm',
  Purchase: 'CompletePayment',
}

export const tiktokProvider: AnalyticsProvider = {
  name: 'tiktok',

  isEnabled() {
    return (
      typeof window !== 'undefined' &&
      typeof window.ttq?.track === 'function' &&
      Boolean(process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID)
    )
  },

  track(event, payload) {
    if (!this.isEnabled()) return

    const params: Record<string, unknown> = {}
    if (payload.value !== undefined) params.value = payload.value
    if (payload.currency) params.currency = payload.currency
    if (payload.contentIds?.length) params.content_id = payload.contentIds[0]
    if (payload.contentName) params.content_name = payload.contentName
    if (payload.contentType) params.content_type = payload.contentType
    if (payload.quantity !== undefined) params.quantity = payload.quantity

    const options = payload.eventId ? { event_id: payload.eventId } : undefined

    window.ttq?.track(EVENT_MAP[event], params, options)
  },
}

export function tiktokPixelScript(pixelId: string): string {
  return `!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${pixelId}');ttq.page();
}(window, document, 'ttq');`
}
