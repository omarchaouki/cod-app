import { z } from 'zod'

/**
 * Normalise a Moroccan mobile number to the canonical local form `06XXXXXXXX`
 * / `07XXXXXXXX`. Accepts the shapes people actually type: +212, 00212, 212,
 * spaces, dashes, dots, parentheses, and Arabic-Indic digits.
 */
const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'
const EASTERN_ARABIC = '۰۱۲۳۴۵۶۷۸۹'

export function normalizePhone(input: string): string {
  let digits = ''

  for (const char of input.trim()) {
    const arabicIndex = ARABIC_INDIC.indexOf(char)
    if (arabicIndex >= 0) {
      digits += String(arabicIndex)
      continue
    }
    const easternIndex = EASTERN_ARABIC.indexOf(char)
    if (easternIndex >= 0) {
      digits += String(easternIndex)
      continue
    }
    if (char >= '0' && char <= '9') digits += char
  }

  if (digits.startsWith('00212')) digits = `0${digits.slice(5)}`
  else if (digits.startsWith('212')) digits = `0${digits.slice(3)}`

  // A number typed as "6XXXXXXXX" is missing its leading zero.
  if (digits.length === 9 && (digits.startsWith('6') || digits.startsWith('7'))) {
    digits = `0${digits}`
  }

  return digits
}

/** Moroccan mobile numbers are 10 digits starting 06 or 07. */
export function isValidMoroccanPhone(input: string): boolean {
  return /^0[67]\d{8}$/.test(normalizePhone(input))
}

const phoneSchema = z
  .string({ required_error: 'المرجو إدخال رقم الهاتف' })
  .trim()
  .min(1, 'المرجو إدخال رقم الهاتف')
  .transform(normalizePhone)
  .refine((value) => /^0[67]\d{8}$/.test(value), {
    message: 'رقم الهاتف غير صحيح. المرجو إدخال رقم مغربي يبدأ بـ 06 أو 07',
  })

const nameSchema = z
  .string({ required_error: 'المرجو إدخال الاسم الكامل' })
  .trim()
  .min(3, 'المرجو إدخال الاسم الكامل')
  .max(120, 'الاسم طويل جداً')
  // Letters (Arabic or Latin) and spaces only — blocks URLs and script payloads
  // that spam bots push into name fields.
  .refine((value) => /[\p{Script=Arabic}\p{Script=Latin}]{3}/u.test(value), {
    message: 'المرجو إدخال اسم صحيح',
  })

const addressSchema = z
  .string({ required_error: 'المرجو إدخال العنوان' })
  .trim()
  .min(10, 'المرجو إدخال العنوان كاملاً: المدينة + الحي + العنوان بالتفصيل')
  .max(400, 'العنوان طويل جداً')

/** Marketing attribution — every field optional, never trusted for pricing. */
export const attributionSchema = z.object({
  source: z.string().trim().max(80).optional().nullable(),
  utm_source: z.string().trim().max(160).optional().nullable(),
  utm_medium: z.string().trim().max(160).optional().nullable(),
  utm_campaign: z.string().trim().max(200).optional().nullable(),
  utm_content: z.string().trim().max(200).optional().nullable(),
  utm_term: z.string().trim().max(200).optional().nullable(),
  fbclid: z.string().trim().max(400).optional().nullable(),
  ttclid: z.string().trim().max(400).optional().nullable(),
  landing_url: z.string().trim().max(600).optional().nullable(),
  referrer: z.string().trim().max(600).optional().nullable(),
})

/**
 * Order payload. Note what is *absent*: no price, no total, no cost. Those are
 * read from the database on the server — a browser can never influence them.
 */
export const orderInputSchema = z.object({
  customer_name: nameSchema,
  phone: phoneSchema,
  address: addressSchema,
  quantity: z.coerce.number().int().min(1).max(20).default(1),
  product_slug: z.string().trim().max(120).optional(),
  // Charset is restricted, not just length: the session id is interpolated
  // into a PostgREST `or(...)` filter, where a comma or parenthesis would let
  // a caller rewrite the query.
  session_id: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, 'invalid session'),
  idempotency_key: z.string().trim().min(8).max(80),
  attribution: attributionSchema.optional(),
  // Honeypot: a real person never fills a hidden field.
  company: z.string().max(0, 'rejected').optional(),
})

export type OrderInput = z.infer<typeof orderInputSchema>

/**
 * Abandoned checkout payload. Only the phone is required — the whole point is
 * to capture the lead the moment a valid number exists, before the rest of the
 * form is filled in.
 */
export const leadInputSchema = z.object({
  full_name: z.string().trim().max(120).optional().nullable(),
  phone: phoneSchema,
  address: z.string().trim().max(400).optional().nullable(),
  product_slug: z.string().trim().max(120).optional(),
  // Charset is restricted, not just length: the session id is interpolated
  // into a PostgREST `or(...)` filter, where a comma or parenthesis would let
  // a caller rewrite the query.
  session_id: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/, 'invalid session'),
  attribution: attributionSchema.optional(),
})

export type LeadInput = z.infer<typeof leadInputSchema>

/* --------------------------- admin-side schemas --------------------------- */

const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,9}([.,]\d{1,2})?$/, 'قيمة غير صحيحة')
  .transform((value) => value.replace(',', '.'))

export const productUpdateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(200),
    short_description: z.string().trim().max(500).optional().nullable(),
    price: moneyString,
    compare_at_price: z.union([moneyString, z.literal('')]).optional(),
    shipping_price: moneyString,
    product_cost: moneyString,
    transport_cost: moneyString,
    other_cost: moneyString,
    is_active: z.boolean(),
  })
  .refine(
    (value) =>
      !value.compare_at_price ||
      Number(value.compare_at_price) >= Number(value.price),
    {
      message: 'السعر قبل التخفيض يجب أن يكون أكبر من أو يساوي سعر البيع',
      path: ['compare_at_price'],
    },
  )

export const orderStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    'NEW',
    'CONFIRMED',
    'SHIPPED',
    'DELIVERED',
    'PAID',
    'CANCELLED',
    'RETURNED',
    'FAILED',
  ]),
})

export const orderCostUpdateSchema = z.object({
  id: z.string().uuid(),
  acquisition_cost: moneyString,
  other_cost: moneyString,
  admin_note: z.string().trim().max(1000).optional().nullable(),
})

export const leadStatusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'NOT_INTERESTED', 'INVALID']),
})

export const settingsUpdateSchema = z.object({
  ad_cost_mode: z.enum(['CPA', 'AD_SPEND']),
  default_cpa: moneyString,
  store_name: z.string().trim().min(2).max(120),
  store_phone: z.string().trim().max(40).optional().nullable(),
})

export const adSpendSchema = z.object({
  spend_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاريخ غير صحيح'),
  platform: z.enum(['META', 'TIKTOK', 'GOOGLE', 'OTHER']),
  amount: moneyString,
  note: z.string().trim().max(300).optional().nullable(),
})
