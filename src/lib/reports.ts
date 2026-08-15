import 'server-only'

import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AdSpendRow,
  DailyRow,
  FinancialsRow,
  FunnelRow,
  LeadsRow,
  Product,
  Settings,
  SourceRow,
} from './db/types'
import type { DateRange } from './metrics'

/**
 * Reporting queries.
 *
 * All aggregation happens in Postgres — exact numeric arithmetic, one query
 * per report — rather than pulling orders into JavaScript and summing them
 * there. That keeps the money exact and the page fast as the order count grows.
 *
 * Each report is exposed on its own so a page can stream it independently: the
 * dashboard renders its shell immediately and lets every section arrive as its
 * query finishes, instead of blocking the whole page on the slowest one.
 *
 * Because several streamed sections legitimately need the same report — the
 * funnel feeds both the delivery rate and the status chart — every loader is
 * wrapped in React's `cache()`. Within a single request the query runs once
 * and the rest read the memoised result, so splitting the page into more
 * sections costs no extra database work. The cache is per-request, so the
 * numbers are never stale between page loads.
 */

export const EMPTY_FINANCIALS: FinancialsRow = {
  paid_orders: 0,
  paid_units: 0,
  paid_revenue: '0',
  product_costs: '0',
  shipping_costs: '0',
  other_costs: '0',
  order_ad_costs: '0',
}

export const EMPTY_FUNNEL: FunnelRow = {
  total_orders: 0,
  confirmed: 0,
  shipped: 0,
  delivered: 0,
  paid: 0,
  cancelled: 0,
  returned: 0,
  failed: 0,
  gross_amount: '0',
}

export const EMPTY_AD_SPEND: AdSpendRow = { total: '0', entries: 0 }

export const EMPTY_LEADS: LeadsRow = {
  total: 0,
  new_leads: 0,
  contacted: 0,
  converted: 0,
  not_interested: 0,
  invalid: 0,
}

/** The reporting RPCs each return a single row, wrapped in an array. */
function firstRow<T>(data: unknown, fallback: T): T {
  if (Array.isArray(data) && data.length > 0) return data[0] as T
  if (data && !Array.isArray(data)) return data as T
  return fallback
}

/**
 * The single memoised entry point. Keyed on the client plus three primitives,
 * so two sections asking for the same report in the same request share one
 * round trip regardless of how the DateRange object was constructed.
 */
const runReport = cache(
  async (supabase: SupabaseClient, fn: string, from: string, to: string): Promise<unknown> => {
    const { data, error } = await supabase.rpc(fn, { from_ts: from, to_ts: to })
    if (error) {
      console.error(`[reports] ${fn}`, error.message)
      return null
    }
    return data
  },
)

function args(range: DateRange): [string, string] {
  return [range.from.toISOString(), range.to.toISOString()]
}

export async function getFinancials(supabase: SupabaseClient, range: DateRange) {
  return firstRow(await runReport(supabase, 'report_financials', ...args(range)), EMPTY_FINANCIALS)
}

export async function getFunnel(supabase: SupabaseClient, range: DateRange) {
  return firstRow(await runReport(supabase, 'report_funnel', ...args(range)), EMPTY_FUNNEL)
}

export async function getAdSpendTotal(supabase: SupabaseClient, range: DateRange) {
  return firstRow(await runReport(supabase, 'report_ad_spend', ...args(range)), EMPTY_AD_SPEND)
}

export async function getLeadCounts(supabase: SupabaseClient, range: DateRange) {
  return firstRow(await runReport(supabase, 'report_leads', ...args(range)), EMPTY_LEADS)
}

export async function getDaily(supabase: SupabaseClient, range: DateRange): Promise<DailyRow[]> {
  return ((await runReport(supabase, 'report_daily', ...args(range))) as DailyRow[] | null) ?? []
}

export async function getSources(supabase: SupabaseClient, range: DateRange): Promise<SourceRow[]> {
  return ((await runReport(supabase, 'report_sources', ...args(range))) as SourceRow[] | null) ?? []
}

export const getSettings = cache(async (supabase: SupabaseClient): Promise<Settings | null> => {
  const { data } = await supabase.from('settings').select('*').eq('id', true).maybeSingle()
  return (data as Settings | null) ?? null
})

export const getActiveProduct = cache(async (supabase: SupabaseClient): Promise<Product | null> => {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as Product | null) ?? null
})

/**
 * The inputs the profitability maths needs. Grouped because they are useless
 * apart — a revenue figure without its cost model cannot be interpreted.
 */
export async function getProfitabilityInputs(supabase: SupabaseClient, range: DateRange) {
  const [financials, adSpend, settings, product] = await Promise.all([
    getFinancials(supabase, range),
    getAdSpendTotal(supabase, range),
    getSettings(supabase),
    getActiveProduct(supabase),
  ])
  return { financials, adSpend, settings, product }
}
