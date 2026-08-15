/**
 * The analytics contract.
 *
 * Components only ever call `trackEvent(name, payload)`. Nothing in the UI
 * knows that Meta or TikTok exist, so adding or removing a platform touches
 * this folder and nothing else.
 */

export type AnalyticsEvent =
  | 'PageView'
  | 'ViewContent'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Lead'
  | 'Purchase'

export interface AnalyticsPayload {
  /** Value in MAD as a plain number. Only meaningful for Lead / Purchase. */
  value?: number
  currency?: string
  contentIds?: string[]
  contentName?: string
  contentType?: string
  quantity?: number
  /** Shared with the server-side Conversions API so the event is deduplicated. */
  eventId?: string
}

export interface AnalyticsProvider {
  name: string
  isEnabled(): boolean
  track(event: AnalyticsEvent, payload: AnalyticsPayload): void
}
