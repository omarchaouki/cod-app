/**
 * Hand-written database types.
 *
 * Money columns are `numeric(12,2)` in Postgres, but they reach the app in two
 * different shapes and it matters which:
 *
 *   - A plain table select comes back through PostgREST as a JSON **number**
 *     (`149`, not `"149.00"`).
 *   - The `report_*` functions cast money to `::text`, so aggregates — every
 *     figure on the dashboard and the profitability page — arrive as exact
 *     decimal **strings** and are never rounded in transit.
 *
 * `Numeric` is therefore honest about both. Always pass these values through
 * `toCentimes()` before doing anything with them: it accepts either shape and
 * converts to integer centimes, which is the only form money is allowed to be
 * arithmetic on. Never treat a `Numeric` as a string — it usually is not one.
 *
 * All summing happens in Postgres, so the JSON-number path only ever carries a
 * single row's value, where `Math.round(v * 100)` recovers the exact centime.
 */
export type Numeric = string | number

export const ORDER_STATUSES = [
  'NEW',
  'CONFIRMED',
  'SHIPPED',
  'DELIVERED',
  'PAID',
  'CANCELLED',
  'RETURNED',
  'FAILED',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'CONVERTED',
  'NOT_INTERESTED',
  'INVALID',
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]

export interface Product {
  id: string
  slug: string
  name: string
  short_description: string | null
  price: Numeric
  compare_at_price: Numeric | null
  shipping_price: Numeric
  product_cost: Numeric
  transport_cost: Numeric
  other_cost: Numeric
  image_path: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Attribution {
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

export interface Order extends Attribution {
  id: string
  order_number: string
  customer_name: string
  phone: string
  address: string
  product_id: string | null
  quantity: number
  unit_price: Numeric
  shipping_charged: Numeric
  total_amount: Numeric
  product_cost: Numeric
  shipping_cost: Numeric
  acquisition_cost: Numeric
  other_cost: Numeric
  profit: Numeric
  status: OrderStatus
  session_id: string | null
  lead_id: string | null
  idempotency_key: string | null
  ip_hash: string | null
  user_agent: string | null
  admin_note: string | null
  event_id: string | null
  purchase_event_sent_at: string | null
  created_at: string
  updated_at: string
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  paid_at: string | null
  cancelled_at: string | null
  returned_at: string | null
  failed_at: string | null
}

export interface AbandonedCheckout extends Attribution {
  id: string
  session_id: string
  full_name: string | null
  phone: string
  address: string | null
  product_id: string | null
  status: LeadStatus
  converted_order_id: string | null
  admin_note: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
}

export interface Settings {
  id: boolean
  ad_cost_mode: 'CPA' | 'AD_SPEND'
  default_cpa: Numeric
  currency: string
  store_name: string
  store_phone: string | null
  created_at: string
  updated_at: string
}

export interface AdSpend {
  id: string
  spend_date: string
  platform: string
  amount: Numeric
  note: string | null
  created_at: string
  updated_at: string
}

/* ------------------------------------------------------------------ *
 * Shapes returned by the SQL reporting functions. Money comes back as
 * text; counts come back as numbers.
 * ------------------------------------------------------------------ */

export interface FinancialsRow {
  paid_orders: number
  paid_units: number
  paid_revenue: string
  product_costs: string
  shipping_costs: string
  other_costs: string
  order_ad_costs: string
}

export interface FunnelRow {
  total_orders: number
  confirmed: number
  shipped: number
  delivered: number
  paid: number
  cancelled: number
  returned: number
  failed: number
  gross_amount: string
}

export interface DailyRow {
  day: string
  orders_count: number
  paid_count: number
  revenue: string
  profit: string
}

export interface SourceRow {
  source: string
  campaign: string
  orders_count: number
  paid_count: number
  paid_revenue: string
  paid_profit: string
}

export interface AdSpendRow {
  total: string
  entries: number
}

export interface LeadsRow {
  total: number
  new_leads: number
  contacted: number
  converted: number
  not_interested: number
  invalid: number
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'جديد',
  CONFIRMED: 'مؤكد',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التسليم',
  PAID: 'مدفوع',
  CANCELLED: 'ملغى',
  RETURNED: 'مرتجع',
  FAILED: 'فشل التسليم',
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'جديد',
  CONTACTED: 'تم الاتصال',
  CONVERTED: 'تحول لطلب',
  NOT_INTERESTED: 'غير مهتم',
  INVALID: 'رقم خاطئ',
}
