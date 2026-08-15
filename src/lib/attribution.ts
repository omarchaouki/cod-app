/**
 * Marketing attribution.
 *
 * Captured on first landing and persisted for the whole visit, so a visitor who
 * arrives from a TikTok ad, scrolls for ten minutes and then orders is still
 * credited to that ad. First-touch wins: later navigations without UTMs never
 * overwrite an existing attribution.
 */

export interface AttributionData {
  source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  fbclid: string | null
  ttclid: string | null
  landing_url: string | null
  referrer: string | null
}

const STORAGE_KEY = 'eps_attribution'
const SESSION_KEY = 'eps_session_id'

const EMPTY: AttributionData = {
  source: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  fbclid: null,
  ttclid: null,
  landing_url: null,
  referrer: null,
}

/**
 * Collapse the raw parameters into one readable channel name, which is what
 * the dashboard groups by: meta, tiktok, google, organic, direct, or the
 * literal utm_source for anything else.
 */
function deriveSource(params: URLSearchParams, referrer: string): string {
  const utmSource = params.get('utm_source')?.toLowerCase().trim()

  if (params.get('fbclid')) return 'meta'
  if (params.get('ttclid')) return 'tiktok'

  if (utmSource) {
    if (/facebook|instagram|meta|fb|ig/.test(utmSource)) return 'meta'
    if (/tiktok|tt/.test(utmSource)) return 'tiktok'
    if (/google|adwords|gads/.test(utmSource)) return 'google'
    return utmSource.slice(0, 60)
  }

  if (!referrer) return 'direct'

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (typeof window !== 'undefined' && host === window.location.hostname) return 'direct'
    if (/facebook|instagram/.test(host)) return 'meta'
    if (/tiktok/.test(host)) return 'tiktok'
    if (/google|bing|yahoo|duckduckgo|ecosia/.test(host)) return 'organic'
    return host.slice(0, 60)
  } catch {
    return 'direct'
  }
}

function clean(value: string | null, max = 200): string | null {
  if (!value) return null
  const trimmed = value.trim().slice(0, max)
  return trimmed.length > 0 ? trimmed : null
}

function hasAnyParam(params: URLSearchParams): boolean {
  return (
    Boolean(params.get('utm_source')) ||
    Boolean(params.get('utm_medium')) ||
    Boolean(params.get('utm_campaign')) ||
    Boolean(params.get('fbclid')) ||
    Boolean(params.get('ttclid'))
  )
}

/**
 * Read attribution from the current URL, merge it with anything already stored,
 * and persist the result. Safe to call on every page view.
 */
export function captureAttribution(): AttributionData {
  if (typeof window === 'undefined') return EMPTY

  const params = new URLSearchParams(window.location.search)
  const referrer = document.referrer || ''
  const stored = readStoredAttribution()

  // First touch wins: only overwrite when this visit actually carries campaign
  // parameters, otherwise an internal navigation would wipe the original ad.
  if (stored && !hasAnyParam(params)) return stored

  const captured: AttributionData = {
    source: deriveSource(params, referrer),
    utm_source: clean(params.get('utm_source')),
    utm_medium: clean(params.get('utm_medium')),
    utm_campaign: clean(params.get('utm_campaign')),
    utm_content: clean(params.get('utm_content')),
    utm_term: clean(params.get('utm_term')),
    fbclid: clean(params.get('fbclid'), 400),
    ttclid: clean(params.get('ttclid'), 400),
    landing_url: clean(window.location.href, 600),
    referrer: clean(referrer, 600),
  }

  const merged: AttributionData = stored
    ? {
        ...stored,
        ...Object.fromEntries(
          Object.entries(captured).filter(([, value]) => value !== null),
        ),
      }
    : captured

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Private browsing or storage disabled — attribution simply isn't persisted.
  }

  return merged
}

export function readStoredAttribution(): AttributionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AttributionData>
    return { ...EMPTY, ...parsed }
  } catch {
    return null
  }
}

export function getAttribution(): AttributionData {
  return readStoredAttribution() ?? captureAttribution()
}

/**
 * A stable per-visitor id. Used to deduplicate abandoned checkouts so that one
 * person filling the form over several minutes produces one lead, not twenty.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) return existing
  } catch {
    // ignore
  }

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

  try {
    window.localStorage.setItem(SESSION_KEY, id)
  } catch {
    // ignore
  }

  return id
}
