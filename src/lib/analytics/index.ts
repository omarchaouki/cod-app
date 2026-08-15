import { gaProvider } from './ga'
import { metaProvider } from './meta'
import { tiktokProvider } from './tiktok'
import type { AnalyticsEvent, AnalyticsPayload, AnalyticsProvider } from './types'

export type { AnalyticsEvent, AnalyticsPayload, AnalyticsProvider } from './types'

const providers: AnalyticsProvider[] = [metaProvider, tiktokProvider, gaProvider]

/** Register an extra platform without touching any component. */
export function registerProvider(provider: AnalyticsProvider) {
  if (!providers.some((p) => p.name === provider.name)) providers.push(provider)
}

/**
 * Events that must only ever fire once per page load. Without this, React
 * Strict Mode in development and any accidental re-render would double-count
 * ViewContent and inflate the campaign numbers.
 */
const oncePerPage = new Set<string>()

export interface TrackOptions {
  once?: boolean
}

/**
 * The single entry point for analytics across the whole app.
 *
 *   trackEvent('ViewContent', { value: 149, currency: 'MAD' })
 *
 * Failures are swallowed: an ad blocker or a broken pixel must never take the
 * order form down with it.
 */
export function trackEvent(
  event: AnalyticsEvent,
  payload: AnalyticsPayload = {},
  options: TrackOptions = {},
): void {
  if (typeof window === 'undefined') return

  if (options.once) {
    if (oncePerPage.has(event)) return
    oncePerPage.add(event)
  }

  const data: AnalyticsPayload = { currency: 'MAD', ...payload }

  for (const provider of providers) {
    try {
      if (provider.isEnabled()) provider.track(event, data)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[analytics] ${provider.name} failed on ${event}`, error)
      }
    }
  }
}

/** Generate an id shared by the browser pixel and the server-side API call. */
export function createEventId(prefix = 'evt'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
