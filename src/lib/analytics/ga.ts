import type { AnalyticsEvent, AnalyticsProvider } from './types'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

const EVENT_MAP: Record<AnalyticsEvent, string> = {
  PageView: 'page_view',
  ViewContent: 'view_item',
  InitiateCheckout: 'begin_checkout',
  AddPaymentInfo: 'add_payment_info',
  Lead: 'generate_lead',
  Purchase: 'purchase',
}

export const gaProvider: AnalyticsProvider = {
  name: 'ga',

  isEnabled() {
    return (
      typeof window !== 'undefined' &&
      typeof window.gtag === 'function' &&
      Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
    )
  },

  track(event, payload) {
    if (!this.isEnabled()) return

    window.gtag?.('event', EVENT_MAP[event], {
      value: payload.value,
      currency: payload.currency,
      items: payload.contentIds?.map((id) => ({
        item_id: id,
        item_name: payload.contentName,
        quantity: payload.quantity,
      })),
      transaction_id: payload.eventId,
    })
  },
}
