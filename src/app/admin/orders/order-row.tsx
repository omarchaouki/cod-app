'use client'

import * as React from 'react'
import { ChevronDown, Loader2, Phone } from 'lucide-react'
import { OrderStatusBadge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { formatMoney, toCentimes } from '@/lib/money'
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type Numeric, type Order } from '@/lib/db/types'
import { updateOrderCosts, updateOrderStatus } from '../actions'

function formatDate(iso: string): string {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Status control shared by the table row and the mobile card. */
function StatusSelect({ order }: { order: Order }) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function change(status: string) {
    setPending(true)
    setError(null)

    const formData = new FormData()
    formData.set('id', order.id)
    formData.set('status', status)

    const result = await updateOrderStatus(formData)
    if (!result.ok) setError(result.error ?? 'تعذّر التحديث.')
    setPending(false)
  }

  return (
    <div>
      <div className="relative">
        <Select
          value={order.status}
          disabled={pending}
          onChange={(e) => change(e.target.value)}
          aria-label={`حالة الطلب ${order.order_number}`}
          aria-busy={pending}
          className="min-w-32"
        >
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ORDER_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>

        {/* Saving a status writes to the database and revalidates three pages,
            so it is worth showing that something is happening. */}
        {pending ? (
          <span className="pointer-events-none absolute inset-y-0 end-2 flex items-center">
            <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
            <span className="sr-only">جاري الحفظ</span>
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-xs font-bold text-cta">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Phone numbers must be one tap to call and one tap to copy on a phone. */
function PhoneLink({ phone }: { phone: string }) {
  const [copied, setCopied] = React.useState(false)

  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={`tel:${phone}`}
        dir="ltr"
        className="num font-bold text-ink underline-offset-2 hover:underline"
      >
        {phone}
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(phone)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            // Clipboard denied — the tel: link still works.
          }
        }}
        aria-label={`نسخ الرقم ${phone}`}
        className="rounded p-1 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink"
      >
        <Phone className="h-3.5 w-3.5" aria-hidden />
      </button>
      {copied ? <span className="text-xs font-bold text-brand">تم النسخ</span> : null}
    </span>
  )
}

export function OrderRow({
  order,
  currency,
  variant,
}: {
  order: Order
  currency: string
  variant: 'row' | 'card'
}) {
  const [open, setOpen] = React.useState(false)

  const amount = formatMoney(toCentimes(order.total_amount), { currency })
  const profitCentimes = toCentimes(order.profit)
  const profit = formatMoney(profitCentimes, { currency })

  if (variant === 'row') {
    return (
      <>
        <tr className="align-middle">
          <td className="whitespace-nowrap px-4 py-3">
            <span className="num font-bold text-ink">{order.order_number}</span>
          </td>
          <td className="px-4 py-3">
            <span className="font-medium text-ink">{order.customer_name}</span>
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <PhoneLink phone={order.phone} />
          </td>
          <td className="num whitespace-nowrap px-4 py-3 font-bold text-ink">{amount}</td>
          <td
            className={`num whitespace-nowrap px-4 py-3 font-bold ${
              profitCentimes >= 0 ? 'text-brand' : 'text-cta'
            }`}
          >
            {order.status === 'PAID' ? profit : <span className="text-ink-muted">—</span>}
          </td>
          <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{order.source ?? 'direct'}</td>
          <td className="px-4 py-3">
            <StatusSelect order={order} />
          </td>
          <td className="num whitespace-nowrap px-4 py-3 text-xs text-ink-muted">
            {formatDate(order.created_at)}
          </td>
          <td className="px-4 py-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={`تفاصيل الطلب ${order.order_number}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-paper-deep"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
          </td>
        </tr>

        {open ? (
          <tr>
            <td colSpan={9} className="bg-paper-deep/40 px-4 py-4">
              <OrderDetails order={order} currency={currency} />
            </td>
          </tr>
        ) : null}
      </>
    )
  }

  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-sm font-black text-ink">{order.order_number}</p>
          <p className="mt-0.5 truncate font-medium text-ink">{order.customer_name}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <PhoneLink phone={order.phone} />
        <p className="leading-relaxed text-ink-soft">{order.address}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line-soft pt-3 text-sm">
        <span className="num font-black text-ink">{amount}</span>
        {order.status === 'PAID' ? (
          <span className={`num font-bold ${profitCentimes >= 0 ? 'text-brand' : 'text-cta'}`}>
            ربح {profit}
          </span>
        ) : null}
        <span className="num text-xs text-ink-muted">{formatDate(order.created_at)}</span>
      </div>

      <div className="mt-3">
        <StatusSelect order={order} />
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft"
      >
        {open ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-3 border-t border-line-soft pt-3">
          <OrderDetails order={order} currency={currency} />
        </div>
      ) : null}
    </article>
  )
}

function OrderDetails({ order, currency }: { order: Order; currency: string }) {
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function save(formData: FormData) {
    setSaving(true)
    setError(null)
    setSaved(false)

    const result = await updateOrderCosts(formData)
    if (result.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      setError(result.error ?? 'تعذّر الحفظ.')
    }
    setSaving(false)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* Address and attribution */}
      <div>
        <h4 className="text-xs font-black uppercase tracking-wide text-ink-muted">العنوان</h4>
        <p className="mt-2 text-sm leading-relaxed text-ink">{order.address}</p>

        <h4 className="mt-4 text-xs font-black uppercase tracking-wide text-ink-muted">
          مصدر الطلب
        </h4>
        <dl className="mt-2 space-y-1 text-sm">
          <Detail label="المصدر" value={order.source} />
          <Detail label="utm_source" value={order.utm_source} />
          <Detail label="utm_medium" value={order.utm_medium} />
          <Detail label="utm_campaign" value={order.utm_campaign} />
          <Detail label="utm_content" value={order.utm_content} />
          <Detail label="utm_term" value={order.utm_term} />
          <Detail label="fbclid" value={order.fbclid ? 'نعم' : null} />
          <Detail label="ttclid" value={order.ttclid ? 'نعم' : null} />
        </dl>
      </div>

      {/* Money breakdown */}
      <div>
        <h4 className="text-xs font-black uppercase tracking-wide text-ink-muted">
          تفصيل المبلغ والتكاليف
        </h4>
        <dl className="mt-2 space-y-1 text-sm">
          <Money label="ثمن الوحدة" value={order.unit_price} currency={currency} />
          <Detail label="الكمية" value={String(order.quantity)} />
          <Money label="التوصيل المؤدى" value={order.shipping_charged} currency={currency} />
          <Money label="المجموع" value={order.total_amount} currency={currency} strong />
          <Money label="تكلفة المنتج" value={order.product_cost} currency={currency} />
          <Money label="تكلفة النقل" value={order.shipping_cost} currency={currency} />
          <Money label="تكلفة الإعلان" value={order.acquisition_cost} currency={currency} />
          <Money label="تكاليف أخرى" value={order.other_cost} currency={currency} />
          <Money label="الربح" value={order.profit} currency={currency} strong />
        </dl>

        {order.status !== 'PAID' ? (
          <p className="mt-3 rounded-lg bg-amber-soft px-3 py-2 text-xs font-bold text-amber">
            هذا الربح تقديري. لا يُحتسب ضمن المداخيل حتى تصبح حالة الطلب «مدفوع».
          </p>
        ) : null}
      </div>

      {/* Editable per-order costs */}
      <form action={save} className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wide text-ink-muted">
          تعديل تكاليف هذا الطلب
        </h4>
        <input type="hidden" name="id" value={order.id} />

        <div className="space-y-1">
          <label
            htmlFor={`acq-${order.id}`}
            className="block text-xs font-bold text-ink-soft"
          >
            تكلفة الإعلان ({currency})
          </label>
          <input
            id={`acq-${order.id}`}
            name="acquisition_cost"
            defaultValue={String(order.acquisition_cost)}
            inputMode="decimal"
            dir="ltr"
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-start text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`other-${order.id}`} className="block text-xs font-bold text-ink-soft">
            تكاليف أخرى ({currency})
          </label>
          <input
            id={`other-${order.id}`}
            name="other_cost"
            defaultValue={String(order.other_cost)}
            inputMode="decimal"
            dir="ltr"
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-start text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={`note-${order.id}`} className="block text-xs font-bold text-ink-soft">
            ملاحظة
          </label>
          <textarea
            id={`note-${order.id}`}
            name="admin_note"
            defaultValue={order.admin_note ?? ''}
            rows={2}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-10 w-full rounded-lg bg-brand text-sm font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ…' : 'حفظ'}
        </button>

        {saved ? <p className="text-xs font-bold text-brand">تم الحفظ.</p> : null}
        {error ? <p className="text-xs font-bold text-cta">{error}</p> : null}
      </form>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="truncate text-end font-medium text-ink" dir="auto">
        {value || '—'}
      </dd>
    </div>
  )
}

function Money({
  label,
  value,
  currency,
  strong,
}: {
  label: string
  value: Numeric
  currency: string
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`num text-end ${strong ? 'font-black text-ink' : 'font-medium text-ink-soft'}`}>
        {formatMoney(toCentimes(value), { currency })}
      </dd>
    </div>
  )
}
