import { formatMoney, toCentimes } from '@/lib/money'
import type { Product } from '@/lib/db/types'

/**
 * The shape of the product handed to client components.
 *
 * Money arrives from the database as exact decimal strings and is turned into
 * display text on the server. The client receives finished strings plus a plain
 * number for the analytics pixels — it is never asked to do money arithmetic,
 * and the values it holds are never trusted on the way back.
 */
export interface ProductView {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  priceLabel: string
  compareAtLabel: string | null
  discountPercent: number | null
  shippingLabel: string
  isFreeShipping: boolean
  totalLabel: string
  /** MAD as a number, for pixel payloads only. */
  analyticsValue: number
  currency: string
}

export function toProductView(product: Product, currency = 'MAD'): ProductView {
  const price = toCentimes(product.price)
  const shipping = toCentimes(product.shipping_price)
  const compareAt = product.compare_at_price ? toCentimes(product.compare_at_price) : null
  const total = price + shipping

  const discountPercent =
    compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    shortDescription: product.short_description,
    priceLabel: formatMoney(price, { currency }),
    compareAtLabel: compareAt ? formatMoney(compareAt, { currency }) : null,
    discountPercent,
    shippingLabel: shipping === 0 ? 'مجاني' : formatMoney(shipping, { currency }),
    isFreeShipping: shipping === 0,
    totalLabel: formatMoney(total, { currency }),
    analyticsValue: total / 100,
    currency,
  }
}
