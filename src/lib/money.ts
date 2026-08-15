/**
 * Money handling.
 *
 * Postgres stores money as `numeric(12,2)` and does all aggregation itself, so
 * the values that reach this module are exact decimal *strings* like "149.00".
 * Inside JavaScript we immediately convert them to integer centimes and never
 * let a money value exist as a fractional Number — that is the only way to keep
 * `0.1 + 0.2` style drift out of the financial reports.
 *
 * A "Centimes" value is always a safe integer. 1 MAD = 100 centimes.
 */

export type Centimes = number

/** Parse an exact decimal string (or a number, for form input) into centimes. */
export function toCentimes(value: string | number | null | undefined): Centimes {
  if (value === null || value === undefined || value === '') return 0

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0
    // Form inputs arrive as numbers. Round at the centime to absorb the float
    // error the browser may already have introduced before we take over.
    return Math.round(value * 100)
  }

  const trimmed = value.trim()
  const match = /^(-)?(\d*)(?:[.,](\d*))?$/.exec(trimmed)
  if (!match) {
    const fallback = Number(trimmed)
    return Number.isFinite(fallback) ? Math.round(fallback * 100) : 0
  }

  const [, sign, whole = '', frac = ''] = match
  const centimes = Number(whole || '0') * 100 + Number((frac + '00').slice(0, 2) || '0')
  return sign === '-' ? -centimes : centimes
}

/** Render centimes back into the exact decimal string Postgres expects. */
export function fromCentimes(centimes: Centimes): string {
  const negative = centimes < 0
  const abs = Math.abs(Math.round(centimes))
  const whole = Math.floor(abs / 100)
  const frac = String(abs % 100).padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${frac}`
}

export function addCentimes(...values: Centimes[]): Centimes {
  return values.reduce((sum, v) => sum + v, 0)
}

export function multiplyCentimes(centimes: Centimes, quantity: number): Centimes {
  return Math.round(centimes * Math.round(quantity))
}

/**
 * Display helper. Arabic pages read more comfortably with Western digits and a
 * thin thousands separator, so the formatting is pinned to `fr-MA`-style
 * grouping rather than the locale of whoever is viewing.
 */
export function formatMoney(centimes: Centimes, options: { currency?: string; decimals?: boolean } = {}): string {
  const { currency = 'MAD', decimals = false } = options
  const value = centimes / 100
  const showDecimals = decimals || centimes % 100 !== 0
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(value)
  return currency ? `${formatted} ${currency}` : formatted
}

/** Convenience for chart tooltips and axis labels. */
export function centimesToUnits(centimes: Centimes): number {
  return Math.round(centimes) / 100
}

/** Percentage as a plain number, guarding against division by zero. */
export function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return numerator / denominator
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatMultiplier(value: number, decimals = 2): string {
  return `${value.toFixed(decimals)}x`
}
