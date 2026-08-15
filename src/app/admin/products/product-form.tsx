'use client'

import * as React from 'react'
import { SectionCard } from '@/components/admin/stat-card'
import { formatMoney, toCentimes } from '@/lib/money'
import type { Product } from '@/lib/db/types'
import { updateProduct } from '../actions'

export function ProductForm({ product, currency }: { product: Product; currency: string }) {
  const [state, setState] = React.useState<{ saving: boolean; message: string | null; error: boolean }>({
    saving: false,
    message: null,
    error: false,
  })

  // Live unit-economics preview, so the consequence of a price change is
  // visible before the form is submitted.
  //
  // Money arrives from PostgREST as a JSON number, so it is stringified once
  // here — a controlled <input> must own a string, not a number.
  const [price, setPrice] = React.useState(String(product.price))
  const [shippingPrice, setShippingPrice] = React.useState(String(product.shipping_price))
  const [productCost, setProductCost] = React.useState(String(product.product_cost))
  const [transportCost, setTransportCost] = React.useState(String(product.transport_cost))
  const [otherCost, setOtherCost] = React.useState(String(product.other_cost))

  const revenue = toCentimes(price) + toCentimes(shippingPrice)
  const costs = toCentimes(productCost) + toCentimes(transportCost) + toCentimes(otherCost)
  const margin = revenue - costs

  async function save(formData: FormData) {
    setState({ saving: true, message: null, error: false })
    const result = await updateProduct(formData)
    setState({
      saving: false,
      message: result.ok ? 'تم الحفظ وتحديث صفحة البيع.' : (result.error ?? 'تعذّر الحفظ.'),
      error: !result.ok,
    })
  }

  return (
    <SectionCard title={product.name} description={`المعرّف: ${product.slug}`}>
      <form action={save} className="space-y-5">
        <input type="hidden" name="id" value={product.id} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="اسم المنتج" htmlFor={`name-${product.id}`}>
            <input
              id={`name-${product.id}`}
              name="name"
              defaultValue={product.name}
              required
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm"
            />
          </Field>

          <Field label="وصف مختصر" htmlFor={`desc-${product.id}`}>
            <input
              id={`desc-${product.id}`}
              name="short_description"
              defaultValue={product.short_description ?? ''}
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm"
            />
          </Field>
        </div>

        <fieldset className="rounded-lg border border-line bg-paper-deep/40 p-4">
          <legend className="px-1 text-sm font-black text-ink">ما يدفعه الزبون</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField
              label={`سعر البيع (${currency})`}
              name="price"
              id={`price-${product.id}`}
              value={price}
              onChange={setPrice}
              required
            />
            <MoneyField
              label={`السعر قبل التخفيض (${currency})`}
              name="compare_at_price"
              id={`compare-${product.id}`}
              defaultValue={product.compare_at_price === null ? '' : String(product.compare_at_price)}
              hint="اتركه فارغاً لإخفاء السعر المشطوب"
            />
            <MoneyField
              label={`التوصيل المؤدى (${currency})`}
              name="shipping_price"
              id={`ship-${product.id}`}
              value={shippingPrice}
              onChange={setShippingPrice}
              hint="0 = التوصيل مجاني"
              required
            />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-line bg-paper-deep/40 p-4">
          <legend className="px-1 text-sm font-black text-ink">ما ندفعه نحن</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <MoneyField
              label={`تكلفة المنتج (${currency})`}
              name="product_cost"
              id={`pcost-${product.id}`}
              value={productCost}
              onChange={setProductCost}
              hint="تكلفة طبع الدفترين"
              required
            />
            <MoneyField
              label={`تكلفة التوصيل (${currency})`}
              name="transport_cost"
              id={`tcost-${product.id}`}
              value={transportCost}
              onChange={setTransportCost}
              hint="ما تدفعه لشركة التوصيل"
              required
            />
            <MoneyField
              label={`تكاليف أخرى (${currency})`}
              name="other_cost"
              id={`ocost-${product.id}`}
              value={otherCost}
              onChange={setOtherCost}
              hint="التغليف، العمولات…"
              required
            />
          </div>
        </fieldset>

        {/* The number that decides whether the ads can ever be profitable. */}
        <div
          className={`rounded-lg border px-4 py-3 ${
            margin > 0 ? 'border-brand/25 bg-brand-soft' : 'border-cta/25 bg-cta-soft'
          }`}
        >
          <p className="text-sm font-bold text-ink">
            الهامش المتاح للإعلان لكل طلب:{' '}
            <span className={`num text-lg font-black ${margin > 0 ? 'text-brand' : 'text-cta'}`}>
              {formatMoney(margin, { currency })}
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {formatMoney(revenue, { currency })} مداخيل − {formatMoney(costs, { currency })} تكاليف.
            هذا هو أقصى ما يمكن إنفاقه إعلانياً لجلب طلب مدفوع واحد دون خسارة.
          </p>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={product.is_active}
            className="h-5 w-5 rounded border-line accent-[#14532d]"
          />
          <span className="text-sm font-bold text-ink">المنتج نشط ومعروض في صفحة البيع</span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={state.saving}
            className="h-11 rounded-lg bg-brand px-6 text-sm font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
          >
            {state.saving ? 'جاري الحفظ…' : 'حفظ التغييرات'}
          </button>

          {state.message ? (
            <p className={`text-sm font-bold ${state.error ? 'text-cta' : 'text-brand'}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </SectionCard>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-bold text-ink-soft">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}

function MoneyField({
  label,
  name,
  id,
  value,
  defaultValue,
  onChange,
  hint,
  required,
}: {
  label: string
  name: string
  id: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  hint?: string
  required?: boolean
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        name={name}
        inputMode="decimal"
        dir="ltr"
        required={required}
        {...(onChange
          ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) }
          : { defaultValue })}
        className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-start text-sm tabular-nums"
      />
    </Field>
  )
}
