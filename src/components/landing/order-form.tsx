'use client'

import * as React from 'react'
import { CheckCircle2, Loader2, ShieldCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { createEventId, trackEvent } from '@/lib/analytics'
import { getAttribution, getSessionId } from '@/lib/attribution'
import { isValidMoroccanPhone, normalizePhone } from '@/lib/validation'
import type { ProductView } from './product-view'

type FieldName = 'customer_name' | 'phone' | 'address'

interface FieldErrors {
  customer_name?: string
  phone?: string
  address?: string
  form?: string
}

interface SuccessState {
  orderNumber: string
  customerName: string
}

const LEAD_DEBOUNCE_MS = 1500

export function OrderForm({ product }: { product: ProductView }) {
  const [values, setValues] = React.useState({ customer_name: '', phone: '', address: '' })
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [touched, setTouched] = React.useState<Partial<Record<FieldName, boolean>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [success, setSuccess] = React.useState<SuccessState | null>(null)

  // One idempotency key per mounted form. A double tap, a flaky network retry
  // or a fast double-click all carry the same key, so the server creates the
  // order exactly once.
  const idempotencyKey = React.useRef<string>(createEventId('ord'))
  const leadTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastLeadSignature = React.useRef<string>('')
  const checkoutTracked = React.useRef(false)
  const formRef = React.useRef<HTMLFormElement>(null)

  /* ------------------------------------------------------------------ *
   * Abandoned checkout capture.
   *
   * The lead is saved as soon as a valid phone number exists — not when the
   * order is submitted — because the whole point is to recover the people who
   * never submit. It is debounced so typing a number produces one write, and
   * a signature guard stops identical payloads from being re-sent.
   * ------------------------------------------------------------------ */
  const saveLead = React.useCallback(
    (current: typeof values, useBeacon = false) => {
      if (!isValidMoroccanPhone(current.phone)) return

      const payload = {
        full_name: current.customer_name.trim() || null,
        phone: normalizePhone(current.phone),
        address: current.address.trim() || null,
        product_slug: product.slug,
        session_id: getSessionId(),
        attribution: getAttribution(),
      }

      const signature = `${payload.phone}|${payload.full_name ?? ''}|${payload.address ?? ''}`
      if (signature === lastLeadSignature.current) return
      lastLeadSignature.current = signature

      const body = JSON.stringify(payload)

      // On page-hide the browser kills in-flight fetches; sendBeacon survives.
      if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        navigator.sendBeacon('/api/leads', new Blob([body], { type: 'application/json' }))
        return
      }

      void fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // A failed lead capture must never surface to the customer.
        lastLeadSignature.current = ''
      })
    },
    [product.slug],
  )

  const scheduleLead = React.useCallback(
    (next: typeof values) => {
      if (leadTimer.current) clearTimeout(leadTimer.current)
      leadTimer.current = setTimeout(() => saveLead(next), LEAD_DEBOUNCE_MS)
    },
    [saveLead],
  )

  // Keep a ref in sync so the pagehide handler always flushes the latest
  // values rather than the ones captured when the effect first ran.
  const valuesRef = React.useRef(values)
  React.useEffect(() => {
    valuesRef.current = values
  }, [values])

  // Catch the visitor who closes the tab mid-form.
  React.useEffect(() => {
    const flush = () => {
      if (success) return
      if (leadTimer.current) clearTimeout(leadTimer.current)
      saveLead(valuesRef.current, true)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      if (leadTimer.current) clearTimeout(leadTimer.current)
    }
  }, [saveLead, success])

  /* ---------------------------- validation ---------------------------- */

  function validateField(name: FieldName, value: string): string | undefined {
    switch (name) {
      case 'customer_name':
        return value.trim().length < 3 ? 'المرجو إدخال الاسم الكامل' : undefined
      case 'phone':
        return isValidMoroccanPhone(value)
          ? undefined
          : 'رقم الهاتف غير صحيح. المرجو إدخال رقم مغربي يبدأ بـ 06 أو 07'
      case 'address':
        return value.trim().length < 10
          ? 'المرجو كتابة المدينة والحي والعنوان بالتفصيل'
          : undefined
    }
  }

  function handleChange(name: FieldName, value: string) {
    const next = { ...values, [name]: value }
    setValues(next)

    // Re-validate while typing only once the field has already errored, so the
    // first attempt is never interrupted mid-word.
    if (touched[name] && errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }))
    }

    if (name === 'phone' && !checkoutTracked.current && isValidMoroccanPhone(value)) {
      checkoutTracked.current = true
      trackEvent('InitiateCheckout', {
        value: product.analyticsValue,
        currency: product.currency,
        contentIds: [product.slug],
        contentName: product.name,
        quantity: 1,
      })
    }

    scheduleLead(next)
  }

  function handleBlur(name: FieldName) {
    setTouched((prev) => ({ ...prev, [name]: true }))
    setErrors((prev) => ({ ...prev, [name]: validateField(name, values[name]) }))
    if (name === 'phone' || name === 'address' || name === 'customer_name') {
      if (leadTimer.current) clearTimeout(leadTimer.current)
      saveLead(values)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const nextErrors: FieldErrors = {
      customer_name: validateField('customer_name', values.customer_name),
      phone: validateField('phone', values.phone),
      address: validateField('address', values.address),
    }
    setTouched({ customer_name: true, phone: true, address: true })
    setErrors(nextErrors)

    const firstInvalid = (['customer_name', 'phone', 'address'] as FieldName[]).find(
      (field) => nextErrors[field],
    )
    if (firstInvalid) {
      // Move focus to the first problem so the fix is one tap away.
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus()
      return
    }

    setSubmitting(true)

    // Shared with the server-side Conversions API call so Meta and TikTok
    // count the browser event and the server event as one.
    const eventId = createEventId('lead')

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: values.customer_name.trim(),
          phone: normalizePhone(values.phone),
          address: values.address.trim(),
          quantity: 1,
          product_slug: product.slug,
          session_id: getSessionId(),
          idempotency_key: idempotencyKey.current,
          attribution: getAttribution(),
          event_id: eventId,
        }),
      })

      const result = (await response.json()) as {
        ok?: boolean
        order_number?: string
        error?: string
        fields?: Record<string, string>
      }

      if (!response.ok || !result.ok) {
        setErrors({
          ...(result.fields ?? {}),
          form: result.error ?? 'تعذّر إرسال الطلب. المرجو المحاولة مرة أخرى.',
        })
        setSubmitting(false)
        return
      }

      /* A submitted cash-on-delivery form is a Lead, not a Purchase. The money
         has not been collected yet — Purchase is sent from the admin when the
         order is actually marked PAID. */
      trackEvent('Lead', {
        value: product.analyticsValue,
        currency: product.currency,
        contentIds: [product.slug],
        contentName: product.name,
        quantity: 1,
        eventId,
      })

      setSuccess({
        orderNumber: result.order_number ?? '',
        customerName: values.customer_name.trim().split(/\s+/)[0],
      })
    } catch {
      setErrors({ form: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.' })
      setSubmitting(false)
    }
  }

  if (success) {
    return <OrderSuccess success={success} product={product} />
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
      aria-labelledby="order-form-title"
    >
      {/* Honeypot. Hidden from people, irresistible to bots. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field
        name="customer_name"
        label="الاسم الكامل"
        error={touched.customer_name ? errors.customer_name : undefined}
      >
        <Input
          id="customer_name"
          name="customer_name"
          value={values.customer_name}
          onChange={(e) => handleChange('customer_name', e.target.value)}
          onBlur={() => handleBlur('customer_name')}
          autoComplete="name"
          enterKeyHint="next"
          placeholder="مثال: محمد العلوي"
          aria-invalid={Boolean(touched.customer_name && errors.customer_name)}
          aria-describedby={errors.customer_name ? 'customer_name-error' : undefined}
          required
        />
      </Field>

      <Field name="phone" label="رقم الهاتف" error={touched.phone ? errors.phone : undefined}>
        <Input
          id="phone"
          name="phone"
          // type=tel brings up the numeric keypad without the spinner and
          // stepper that type=number adds.
          type="tel"
          inputMode="tel"
          dir="ltr"
          className="text-start"
          value={values.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          onBlur={() => handleBlur('phone')}
          autoComplete="tel"
          enterKeyHint="next"
          placeholder="06 12 34 56 78"
          aria-invalid={Boolean(touched.phone && errors.phone)}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
          required
        />
      </Field>

      <Field
        name="address"
        label="العنوان"
        hint="المدينة + الحي + العنوان بالتفصيل"
        error={touched.address ? errors.address : undefined}
      >
        <Textarea
          id="address"
          name="address"
          rows={3}
          value={values.address}
          onChange={(e) => handleChange('address', e.target.value)}
          onBlur={() => handleBlur('address')}
          autoComplete="street-address"
          enterKeyHint="done"
          placeholder="مثال: مراكش، حي المسيرة 1، زنقة 12 رقم 45"
          aria-invalid={Boolean(touched.address && errors.address)}
          aria-describedby={errors.address ? 'address-error' : undefined}
          required
        />
      </Field>

      {errors.form ? (
        <p
          role="alert"
          className="rounded-lg border border-cta/30 bg-cta-soft px-4 py-3 text-sm font-bold text-cta"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="rounded-lg bg-paper-deep p-4">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">ثمن الباك</dt>
            <dd className="num font-bold text-ink">{product.priceLabel}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-ink-soft">التوصيل</dt>
            <dd className={product.isFreeShipping ? 'font-bold text-brand' : 'num font-bold text-ink'}>
              {product.shippingLabel}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2">
            <dt className="text-base font-bold text-ink">المجموع</dt>
            <dd className="num text-xl font-black text-cta">{product.totalLabel}</dd>
          </div>
        </dl>
      </div>

      <Button
        type="submit"
        variant="cta"
        size="xl"
        className="w-full text-xl"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            جاري إرسال الطلب…
          </>
        ) : (
          'اطلب الآن'
        )}
      </Button>

      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-soft">
        <li className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
          الدفع عند الاستلام
        </li>
        <li className="flex items-center gap-1.5">
          <Truck className="h-4 w-4 text-brand" aria-hidden />
          التوصيل لجميع المدن
        </li>
      </ul>
    </form>
  )
}

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: FieldName
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        <span className="text-cta" aria-hidden>
          {' '}
          *
        </span>
      </Label>
      {hint ? <p className="-mt-1 text-sm text-ink-muted">{hint}</p> : null}
      {children}
      {error ? (
        <p id={`${name}-error`} role="alert" className="text-sm font-bold text-cta">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function OrderSuccess({ success, product }: { success: SuccessState; product: ProductView }) {
  const headingRef = React.useRef<HTMLHeadingElement>(null)

  // Move focus to the confirmation so screen reader users are told the order
  // went through instead of landing back at the top of the page.
  React.useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <div className="py-4 text-center" role="status" aria-live="polite">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
        <CheckCircle2 className="h-9 w-9 text-brand" aria-hidden />
      </div>

      <h3
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 text-2xl font-black text-ink outline-none sm:text-3xl"
      >
        تم تسجيل طلبك بنجاح
      </h3>

      <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink-soft">
        شكراً {success.customerName}. سيتصل بك فريقنا هاتفياً لتأكيد الطلب والعنوان قبل الإرسال.
      </p>

      {success.orderNumber ? (
        <div className="mx-auto mt-6 inline-flex flex-col items-center gap-1 rounded-lg border border-line bg-paper-deep px-6 py-4">
          <span className="text-sm text-ink-muted">رقم الطلب</span>
          <span className="num text-xl font-black tracking-wider text-ink">
            {success.orderNumber}
          </span>
        </div>
      ) : null}

      <div className="mx-auto mt-6 max-w-md rounded-lg border border-line bg-surface p-4 text-start">
        <p className="text-sm font-bold text-ink">{product.name}</p>
        <p className="num mt-1 text-sm text-ink-soft">
          المبلغ المطلوب عند الاستلام: <span className="font-bold text-ink">{product.totalLabel}</span>
        </p>
      </div>

      <p className="mt-6 text-sm text-ink-muted">
        احتفظ برقم الطلب. لن تدفع أي مبلغ قبل استلام الدفترين.
      </p>
    </div>
  )
}
