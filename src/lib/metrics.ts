/**
 * Profitability and COD funnel maths.
 *
 * Every money figure in and out of this module is integer centimes. The inputs
 * come from Postgres as exact decimal strings, so nothing here ever touches a
 * fractional Number for money. Ratios (margins, rates, ROAS) are floats by
 * nature and only used for display.
 *
 * THE REVENUE RULE
 * Revenue means orders with status = PAID and nothing else. Submitted,
 * confirmed, shipped and even delivered orders are not revenue — with cash on
 * delivery the money is real only once it has been collected.
 */

import { ratio, toCentimes, type Centimes } from './money'
import type { AdSpendRow, FinancialsRow, FunnelRow, Numeric } from './db/types'

export interface ProfitabilityInput {
  financials: FinancialsRow
  adSpend: AdSpendRow
  /** Manual cost-per-acquisition, used when ad_cost_mode is 'CPA'. */
  defaultCpa: Numeric
  adCostMode: 'CPA' | 'AD_SPEND'
  /** Current catalogue values, used for the per-unit break-even figures. */
  product: {
    price: Numeric
    shipping_price: Numeric
    product_cost: Numeric
    transport_cost: Numeric
    other_cost: Numeric
  } | null
}

export interface Profitability {
  paidOrders: number
  paidUnits: number
  paidRevenue: Centimes

  productCosts: Centimes
  transportCosts: Centimes
  otherCosts: Centimes
  advertisingCosts: Centimes
  totalCosts: Centimes

  netProfit: Centimes
  profitMargin: number
  averageOrderValue: Centimes
  averageProfitPerPaidOrder: Centimes

  /** Advertising cost per paid order, from real spend or the manual CPA. */
  cpa: Centimes
  roas: number

  /**
   * Contribution margin per paid order before advertising. This is the most
   * that may be spent to acquire one paying customer while still breaking
   * even — the ceiling on the ad budget.
   */
  maxProfitableCpa: Centimes
  breakEvenCpa: Centimes
  breakEvenRoas: number
  cpaHeadroom: Centimes
  isProfitable: boolean

  /** Same ceiling computed from the catalogue, independent of any sales yet. */
  unitEconomics: {
    sellingPrice: Centimes
    productCost: Centimes
    transportCost: Centimes
    otherCost: Centimes
    contributionMargin: Centimes
    maxProfitableCpa: Centimes
  } | null
}

export function computeProfitability(input: ProfitabilityInput): Profitability {
  const { financials, adSpend, defaultCpa, adCostMode, product } = input

  const paidOrders = Number(financials.paid_orders) || 0
  const paidUnits = Number(financials.paid_units) || 0
  const paidRevenue = toCentimes(financials.paid_revenue)

  const productCosts = toCentimes(financials.product_costs)
  const transportCosts = toCentimes(financials.shipping_costs)
  const otherCosts = toCentimes(financials.other_costs)

  // Advertising cost comes either from real spend booked in the period, or
  // from a manual CPA multiplied by the number of paid orders. Per-order
  // acquisition_cost values recorded on individual orders always win, because
  // they are the most specific data available.
  const perOrderAdCosts = toCentimes(financials.order_ad_costs)
  const bookedSpend = toCentimes(adSpend.total)

  let advertisingCosts: Centimes
  if (perOrderAdCosts > 0) {
    advertisingCosts = perOrderAdCosts
  } else if (adCostMode === 'AD_SPEND') {
    advertisingCosts = bookedSpend
  } else {
    advertisingCosts = toCentimes(defaultCpa) * paidOrders
  }

  const totalCosts = productCosts + transportCosts + otherCosts + advertisingCosts
  const netProfit = paidRevenue - totalCosts

  const profitMargin = ratio(netProfit, paidRevenue)
  const averageOrderValue = paidOrders > 0 ? Math.round(paidRevenue / paidOrders) : 0
  const averageProfitPerPaidOrder = paidOrders > 0 ? Math.round(netProfit / paidOrders) : 0

  const cpa = paidOrders > 0 ? Math.round(advertisingCosts / paidOrders) : 0
  const roas = ratio(paidRevenue, advertisingCosts)

  // Everything left over per paid order once the variable costs that are not
  // advertising have been paid.
  const contributionMargin = paidRevenue - productCosts - transportCosts - otherCosts
  const maxProfitableCpa = paidOrders > 0 ? Math.round(contributionMargin / paidOrders) : 0
  const breakEvenCpa = maxProfitableCpa
  const breakEvenRoas = ratio(paidRevenue, contributionMargin)
  const cpaHeadroom = maxProfitableCpa - cpa

  const unitEconomics = product
    ? (() => {
        const sellingPrice = toCentimes(product.price) + toCentimes(product.shipping_price)
        const unitProductCost = toCentimes(product.product_cost)
        const unitTransport = toCentimes(product.transport_cost)
        const unitOther = toCentimes(product.other_cost)
        const margin = sellingPrice - unitProductCost - unitTransport - unitOther
        return {
          sellingPrice,
          productCost: unitProductCost,
          transportCost: unitTransport,
          otherCost: unitOther,
          contributionMargin: margin,
          maxProfitableCpa: margin,
        }
      })()
    : null

  return {
    paidOrders,
    paidUnits,
    paidRevenue,
    productCosts,
    transportCosts,
    otherCosts,
    advertisingCosts,
    totalCosts,
    netProfit,
    profitMargin,
    averageOrderValue,
    averageProfitPerPaidOrder,
    cpa,
    roas,
    maxProfitableCpa,
    breakEvenCpa,
    breakEvenRoas,
    cpaHeadroom,
    // With no paid orders yet there is nothing to be profitable about.
    isProfitable: paidOrders > 0 && netProfit > 0,
    unitEconomics,
  }
}

export interface CodMetrics {
  totalOrders: number
  confirmed: number
  shipped: number
  delivered: number
  paid: number
  cancelled: number
  returned: number
  failed: number

  /** Each rate carries its denominator so the dashboard can label it exactly. */
  confirmationRate: number
  shippingRate: number
  deliveryRate: number
  paidRate: number
  cancellationRate: number
  returnRate: number
  failedRate: number
}

/**
 * Funnel rates are computed from the status *timestamps*, not the current
 * status. An order sitting at PAID has necessarily been confirmed, shipped and
 * delivered along the way, and the timestamps record that — counting current
 * statuses instead would make every rate collapse as orders progress.
 */
export function computeCodMetrics(funnel: FunnelRow): CodMetrics {
  const totalOrders = Number(funnel.total_orders) || 0
  const confirmed = Number(funnel.confirmed) || 0
  const shipped = Number(funnel.shipped) || 0
  const delivered = Number(funnel.delivered) || 0
  const paid = Number(funnel.paid) || 0
  const cancelled = Number(funnel.cancelled) || 0
  const returned = Number(funnel.returned) || 0
  const failed = Number(funnel.failed) || 0

  return {
    totalOrders,
    confirmed,
    shipped,
    delivered,
    paid,
    cancelled,
    returned,
    failed,
    confirmationRate: ratio(confirmed, totalOrders),
    shippingRate: ratio(shipped, confirmed),
    deliveryRate: ratio(delivered, shipped),
    paidRate: ratio(paid, totalOrders),
    cancellationRate: ratio(cancelled, totalOrders),
    returnRate: ratio(returned, totalOrders),
    failedRate: ratio(failed, totalOrders),
  }
}

/* ------------------------------- date ranges ------------------------------ */

export type RangeKey = 'today' | 'yesterday' | 'last7' | 'last30' | 'month' | 'all' | 'custom'

export interface DateRange {
  from: Date
  to: Date
  key: RangeKey
  label: string
}

export const RANGE_LABELS: Record<Exclude<RangeKey, 'custom'>, string> = {
  today: 'اليوم',
  yesterday: 'أمس',
  last7: 'آخر 7 أيام',
  last30: 'آخر 30 يوم',
  month: 'هذا الشهر',
  all: 'كل الفترات',
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Ranges are half-open [from, to) so a day is never counted twice at a
 * boundary. `to` is always the start of the day *after* the last included day.
 */
export function resolveRange(key: string | undefined, from?: string, to?: string): DateRange {
  const now = new Date()
  const today = startOfDay(now)

  switch (key) {
    case 'today':
      return { from: today, to: addDays(today, 1), key: 'today', label: RANGE_LABELS.today }
    case 'yesterday':
      return { from: addDays(today, -1), to: today, key: 'yesterday', label: RANGE_LABELS.yesterday }
    case 'last7':
      return { from: addDays(today, -6), to: addDays(today, 1), key: 'last7', label: RANGE_LABELS.last7 }
    case 'month':
      return {
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: addDays(today, 1),
        key: 'month',
        label: RANGE_LABELS.month,
      }
    case 'all':
      return { from: new Date(2020, 0, 1), to: addDays(today, 1), key: 'all', label: RANGE_LABELS.all }
    case 'custom': {
      const parsedFrom = from ? new Date(`${from}T00:00:00`) : addDays(today, -29)
      const parsedTo = to ? addDays(new Date(`${to}T00:00:00`), 1) : addDays(today, 1)
      const validFrom = Number.isNaN(parsedFrom.getTime()) ? addDays(today, -29) : parsedFrom
      const validTo = Number.isNaN(parsedTo.getTime()) ? addDays(today, 1) : parsedTo
      return {
        from: validFrom,
        to: validTo,
        key: 'custom',
        label: `${formatDateInput(validFrom)} ← ${formatDateInput(addDays(validTo, -1))}`,
      }
    }
    default:
      return { from: addDays(today, -29), to: addDays(today, 1), key: 'last30', label: RANGE_LABELS.last30 }
  }
}

export function formatDateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
