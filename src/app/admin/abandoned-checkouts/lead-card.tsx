'use client'

import * as React from 'react'
import { Copy, Loader2, MessageCircle, PhoneCall } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type AbandonedCheckout } from '@/lib/db/types'
import { updateLeadStatus } from '../actions'

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** WhatsApp expects the international form without a plus sign. */
function toWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `212${digits.slice(1)}` : digits
}

export function LeadCard({ lead }: { lead: AbandonedCheckout }) {
  const [status, setStatus] = React.useState(lead.status)
  const [pending, setPending] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function changeStatus(next: string) {
    const previous = status
    setStatus(next as typeof status)
    setPending(true)
    setError(null)

    const formData = new FormData()
    formData.set('id', lead.id)
    formData.set('status', next)

    const result = await updateLeadStatus(formData)
    if (!result.ok) {
      // Roll the optimistic update back so the card never shows a state the
      // database refused.
      setStatus(previous)
      setError(result.error ?? 'تعذّر التحديث.')
    }
    setPending(false)
  }

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(lead.phone)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the call and WhatsApp buttons still work.
    }
  }

  return (
    <article className="flex flex-col rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{lead.full_name || 'بدون اسم'}</p>
          <p className="num mt-0.5 text-xs text-ink-muted">{formatDate(lead.created_at)}</p>
        </div>
        {lead.converted_order_id ? (
          <span className="shrink-0 rounded-md bg-brand-soft px-2 py-1 text-xs font-bold text-brand-ink">
            صار طلباً
          </span>
        ) : null}
      </div>

      {/* Phone: the whole point of this page — call, WhatsApp, or copy. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={`tel:${lead.phone}`}
          dir="ltr"
          className="num inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-black text-white transition-colors hover:bg-brand-ink"
        >
          <PhoneCall className="h-4 w-4" aria-hidden />
          {lead.phone}
        </a>

        <a
          href={`https://wa.me/${toWhatsApp(lead.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`مراسلة ${lead.phone} على واتساب`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-paper-deep"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
        </a>

        <button
          type="button"
          onClick={copyPhone}
          aria-label={`نسخ الرقم ${lead.phone}`}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:bg-paper-deep"
        >
          <Copy className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {copied ? <p className="mt-1.5 text-xs font-bold text-brand">تم نسخ الرقم.</p> : null}

      {lead.address ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{lead.address}</p>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">لم يُدخل العنوان.</p>
      )}

      <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-xs">
        <Row label="المصدر" value={lead.source} />
        <Row label="الحملة" value={lead.utm_campaign} />
        <Row label="المحتوى" value={lead.utm_content} />
        {lead.fbclid ? <Row label="نقرة" value="Meta" /> : null}
        {lead.ttclid ? <Row label="نقرة" value="TikTok" /> : null}
      </dl>

      <div className="mt-auto pt-3">
        <label htmlFor={`lead-status-${lead.id}`} className="sr-only">
          حالة السلة المتروكة
        </label>
        <div className="relative">
          <Select
            id={`lead-status-${lead.id}`}
            value={status}
            disabled={pending}
            aria-busy={pending}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>

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
    </article>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="truncate text-end font-bold text-ink-soft" dir="auto">
        {value || '—'}
      </dd>
    </div>
  )
}
