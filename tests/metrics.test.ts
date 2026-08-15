import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeCodMetrics, computeProfitability, resolveRange } from '../src/lib/metrics.ts'
import { fromCentimes } from '../src/lib/money.ts'

const NO_AD_SPEND = { total: '0', entries: 0 }

/**
 * The worked example from the brief:
 *   selling price 99, product cost 20, transport 25, CPA 18, other 3
 *   → profit 33 per order.
 */
test('reproduces the per-order profit example exactly', () => {
  const result = computeProfitability({
    financials: {
      paid_orders: 1,
      paid_units: 1,
      paid_revenue: '99.00',
      product_costs: '20.00',
      shipping_costs: '25.00',
      other_costs: '3.00',
      order_ad_costs: '0',
    },
    adSpend: NO_AD_SPEND,
    defaultCpa: '18.00',
    adCostMode: 'CPA',
    product: null,
  })

  assert.equal(fromCentimes(result.netProfit), '33.00')
  assert.equal(fromCentimes(result.advertisingCosts), '18.00')
  assert.equal(fromCentimes(result.cpa), '18.00')
  // 99 − 20 − 25 − 3 = 51 available for advertising before breaking even.
  assert.equal(fromCentimes(result.maxProfitableCpa), '51.00')
  assert.equal(fromCentimes(result.cpaHeadroom), '33.00')
  assert.equal(result.isProfitable, true)
})

/**
 * THE REVENUE RULE.
 * Only PAID orders may contribute to revenue. The scenario in the brief:
 * 100 submitted, 80 confirmed, 70 shipped, 60 delivered, 55 paid.
 */
test('revenue counts only paid orders, never the wider funnel', () => {
  // What the SQL layer returns: it already filters on status = 'PAID', so the
  // 55 paid orders at 99 MAD are the only revenue that reaches this function.
  const result = computeProfitability({
    financials: {
      paid_orders: 55,
      paid_units: 55,
      paid_revenue: '5445.00', // 55 × 99
      product_costs: '1100.00', // 55 × 20
      shipping_costs: '1375.00', // 55 × 25
      other_costs: '165.00', // 55 × 3
      order_ad_costs: '0',
    },
    adSpend: NO_AD_SPEND,
    defaultCpa: '18.00',
    adCostMode: 'CPA',
    product: null,
  })

  assert.equal(result.paidOrders, 55)
  assert.equal(fromCentimes(result.paidRevenue), '5445.00')

  // Not 100 × 99 = 9900, and not 60 × 99 = 5940 for the delivered ones.
  assert.notEqual(fromCentimes(result.paidRevenue), '9900.00')
  assert.notEqual(fromCentimes(result.paidRevenue), '5940.00')

  // Advertising is charged per paid order: 55 × 18 = 990.
  assert.equal(fromCentimes(result.advertisingCosts), '990.00')
  // 5445 − 1100 − 1375 − 165 − 990 = 1815
  assert.equal(fromCentimes(result.netProfit), '1815.00')
  assert.equal(fromCentimes(result.averageOrderValue), '99.00')
  assert.equal(fromCentimes(result.averageProfitPerPaidOrder), '33.00')
})

test('reproduces the dashboard figures from the brief', () => {
  const result = computeProfitability({
    financials: {
      paid_orders: 250,
      paid_units: 250,
      paid_revenue: '24750.00',
      product_costs: '5000.00',
      shipping_costs: '6250.00',
      other_costs: '750.00',
      order_ad_costs: '0',
    },
    adSpend: { total: '4500.00', entries: 12 },
    defaultCpa: '0',
    adCostMode: 'AD_SPEND',
    product: null,
  })

  assert.equal(fromCentimes(result.netProfit), '8250.00')
  assert.equal(result.profitMargin.toFixed(3), '0.333')
  assert.equal(fromCentimes(result.cpa), '18.00')
  assert.equal(fromCentimes(result.maxProfitableCpa), '51.00')
  assert.equal(result.roas.toFixed(2), '5.50')
  assert.equal(result.isProfitable, true)
})

test('flags an unprofitable campaign and reports negative headroom', () => {
  const result = computeProfitability({
    financials: {
      paid_orders: 10,
      paid_units: 10,
      paid_revenue: '990.00',
      product_costs: '200.00',
      shipping_costs: '250.00',
      other_costs: '30.00',
      order_ad_costs: '0',
    },
    adSpend: NO_AD_SPEND,
    // 70 per order against a 51 ceiling.
    defaultCpa: '70.00',
    adCostMode: 'CPA',
    product: null,
  })

  assert.equal(result.isProfitable, false)
  assert.equal(fromCentimes(result.netProfit), '-190.00')
  assert.equal(fromCentimes(result.maxProfitableCpa), '51.00')
  assert.equal(fromCentimes(result.cpaHeadroom), '-19.00')
})

test('per-order acquisition costs take priority over the estimate', () => {
  const result = computeProfitability({
    financials: {
      paid_orders: 2,
      paid_units: 2,
      paid_revenue: '198.00',
      product_costs: '40.00',
      shipping_costs: '50.00',
      other_costs: '6.00',
      // Real spend recorded against the orders themselves.
      order_ad_costs: '30.00',
    },
    adSpend: { total: '999.00', entries: 3 },
    defaultCpa: '18.00',
    adCostMode: 'AD_SPEND',
    product: null,
  })

  // Neither the 999 booked spend nor 2 × 18 — the specific figure wins.
  assert.equal(fromCentimes(result.advertisingCosts), '30.00')
  assert.equal(fromCentimes(result.netProfit), '72.00')
})

test('is not profitable when nothing has been paid yet', () => {
  const result = computeProfitability({
    financials: {
      paid_orders: 0,
      paid_units: 0,
      paid_revenue: '0',
      product_costs: '0',
      shipping_costs: '0',
      other_costs: '0',
      order_ad_costs: '0',
    },
    adSpend: { total: '500.00', entries: 2 },
    defaultCpa: '18.00',
    adCostMode: 'AD_SPEND',
    product: null,
  })

  assert.equal(result.isProfitable, false)
  assert.equal(result.paidOrders, 0)
  assert.equal(fromCentimes(result.paidRevenue), '0.00')
  assert.equal(result.cpa, 0)
  assert.equal(result.profitMargin, 0)
})

test('derives unit economics from the catalogue independently of sales', () => {
  const result = computeProfitability({
    financials: {
      paid_orders: 0,
      paid_units: 0,
      paid_revenue: '0',
      product_costs: '0',
      shipping_costs: '0',
      other_costs: '0',
      order_ad_costs: '0',
    },
    adSpend: NO_AD_SPEND,
    defaultCpa: '0',
    adCostMode: 'CPA',
    product: {
      price: '149.00',
      shipping_price: '0.00',
      product_cost: '45.00',
      transport_cost: '25.00',
      other_cost: '5.00',
    },
  })

  assert.ok(result.unitEconomics)
  // 149 − 45 − 25 − 5 = 74
  assert.equal(fromCentimes(result.unitEconomics.contributionMargin), '74.00')
  assert.equal(fromCentimes(result.unitEconomics.maxProfitableCpa), '74.00')
})

/* --------------------------------- COD ---------------------------------- */

test('computes COD funnel rates against the right denominators', () => {
  const cod = computeCodMetrics({
    total_orders: 100,
    confirmed: 80,
    shipped: 70,
    delivered: 60,
    paid: 55,
    cancelled: 12,
    returned: 5,
    failed: 3,
    gross_amount: '9900.00',
  })

  assert.equal(cod.confirmationRate, 0.8) // 80 / 100 total
  assert.equal(cod.shippingRate, 0.875) // 70 / 80 confirmed
  assert.equal(cod.deliveryRate, 60 / 70) // delivered / shipped
  assert.equal(cod.paidRate, 0.55) // 55 / 100 total
  assert.equal(cod.cancellationRate, 0.12)
  assert.equal(cod.returnRate, 0.05)
  assert.equal(cod.failedRate, 0.03)
})

test('COD rates stay at zero rather than dividing by zero', () => {
  const cod = computeCodMetrics({
    total_orders: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    paid: 0,
    cancelled: 0,
    returned: 0,
    failed: 0,
    gross_amount: '0',
  })

  assert.equal(cod.confirmationRate, 0)
  assert.equal(cod.deliveryRate, 0)
  assert.equal(cod.paidRate, 0)
})

/* ------------------------------ date ranges ------------------------------ */

test('date ranges are half-open so no day is counted twice', () => {
  const today = resolveRange('today')
  assert.equal(today.to.getTime() - today.from.getTime(), 24 * 60 * 60 * 1000)

  const yesterday = resolveRange('yesterday')
  // Yesterday ends exactly where today begins.
  assert.equal(yesterday.to.getTime(), today.from.getTime())

  const last7 = resolveRange('last7')
  assert.equal(Math.round((last7.to.getTime() - last7.from.getTime()) / 86400000), 7)

  const last30 = resolveRange(undefined)
  assert.equal(last30.key, 'last30')
  assert.equal(Math.round((last30.to.getTime() - last30.from.getTime()) / 86400000), 30)
})

test('a custom range includes its final day', () => {
  const range = resolveRange('custom', '2026-08-01', '2026-08-31')
  assert.equal(range.from.getDate(), 1)
  // `to` is the start of 1 September, so 31 August is fully included.
  assert.equal(range.to.getMonth(), 8)
  assert.equal(range.to.getDate(), 1)
})

test('an invalid custom range falls back instead of throwing', () => {
  const range = resolveRange('custom', 'not-a-date', 'also-bad')
  assert.ok(!Number.isNaN(range.from.getTime()))
  assert.ok(!Number.isNaN(range.to.getTime()))
})
