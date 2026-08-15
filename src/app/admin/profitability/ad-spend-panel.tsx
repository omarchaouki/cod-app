'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'
import { SectionCard } from '@/components/admin/stat-card'
import { Select } from '@/components/ui/select'
import { formatMoney, toCentimes } from '@/lib/money'
import type { AdSpend, Numeric } from '@/lib/db/types'
import { deleteAdSpend, updateSettings, upsertAdSpend } from '../actions'

const PLATFORMS = [
  { value: 'META', label: 'Meta (فيسبوك/إنستغرام)' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'GOOGLE', label: 'Google' },
  { value: 'OTHER', label: 'أخرى' },
]

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Advertising cost input.
 *
 * Two models, because the two are useful at different times: a flat CPA when
 * you are estimating, and real daily spend once campaigns are running. Real
 * spend is what makes ROAS meaningful, so the panel says so plainly.
 */
export function AdSpendPanel({
  entries,
  currency,
  adCostMode,
  defaultCpa,
  storeName,
  storePhone,
  periodTotal,
  periodEntries,
}: {
  entries: AdSpend[]
  currency: string
  adCostMode: 'CPA' | 'AD_SPEND'
  defaultCpa: Numeric
  storeName: string
  storePhone: string | null
  periodTotal: string
  periodEntries: number
}) {
  return (
    <SectionCard
      title="المصاريف الإعلانية"
      description={`المسجَّل في هذه الفترة: ${periodTotal} عبر ${periodEntries} إدخال`}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ModeForm
          adCostMode={adCostMode}
          defaultCpa={defaultCpa}
          currency={currency}
          storeName={storeName}
          storePhone={storePhone}
        />
        <SpendForm currency={currency} />
      </div>

      {entries.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper-deep/60">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-start font-bold text-ink-soft">
                  التاريخ
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-bold text-ink-soft">
                  المنصة
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-bold text-ink-soft">
                  المبلغ
                </th>
                <th scope="col" className="px-4 py-2.5 text-start font-bold text-ink-soft">
                  ملاحظة
                </th>
                <th scope="col" className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {entries.map((entry) => (
                <SpendRow key={entry.id} entry={entry} currency={currency} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-paper-deep/50 px-4 py-5 text-center text-sm text-ink-muted">
          لم تُسجَّل أي مصاريف إعلانية بعد.
        </p>
      )}
    </SectionCard>
  )
}

function ModeForm({
  adCostMode,
  defaultCpa,
  currency,
  storeName,
  storePhone,
}: {
  adCostMode: 'CPA' | 'AD_SPEND'
  defaultCpa: Numeric
  currency: string
  storeName: string
  storePhone: string | null
}) {
  const [mode, setMode] = React.useState(adCostMode)
  const [state, setState] = React.useState<{ saving: boolean; message: string | null; error: boolean }>({
    saving: false,
    message: null,
    error: false,
  })

  async function save(formData: FormData) {
    setState({ saving: true, message: null, error: false })
    const result = await updateSettings(formData)
    setState({
      saving: false,
      message: result.ok ? 'تم الحفظ.' : (result.error ?? 'تعذّر الحفظ.'),
      error: !result.ok,
    })
  }

  return (
    <form action={save} className="space-y-3 rounded-lg border border-line bg-paper-deep/40 p-4">
      <h3 className="text-sm font-black text-ink">طريقة احتساب المصاريف</h3>

      <div className="space-y-1">
        <label htmlFor="ad_cost_mode" className="block text-xs font-bold text-ink-soft">
          النموذج
        </label>
        <Select
          id="ad_cost_mode"
          name="ad_cost_mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'CPA' | 'AD_SPEND')}
        >
          <option value="CPA">تكلفة ثابتة لكل طلب (CPA)</option>
          <option value="AD_SPEND">المصاريف الفعلية المسجَّلة</option>
        </Select>
      </div>

      <div className="space-y-1">
        <label htmlFor="default_cpa" className="block text-xs font-bold text-ink-soft">
          تكلفة الاكتساب الافتراضية ({currency})
        </label>
        <input
          id="default_cpa"
          name="default_cpa"
          defaultValue={String(defaultCpa)}
          inputMode="decimal"
          dir="ltr"
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-start text-sm"
        />
        <p className="text-xs leading-relaxed text-ink-muted">
          {mode === 'CPA'
            ? 'تُضرب في عدد الطلبات المدفوعة لتقدير المصاريف الإعلانية.'
            : 'غير مستعملة في هذا النموذج، تُحتسب المصاريف الفعلية المسجَّلة أسفله.'}
        </p>
      </div>

      {/* Carried through so saving the ad model does not blank the store
          identity that shares the same settings row. */}
      <input type="hidden" name="store_name" value={storeName} />
      <input type="hidden" name="store_phone" value={storePhone ?? ''} />

      <button
        type="submit"
        disabled={state.saving}
        className="h-10 w-full rounded-lg bg-brand text-sm font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
      >
        {state.saving ? 'جاري الحفظ…' : 'حفظ النموذج'}
      </button>

      {state.message ? (
        <p className={`text-xs font-bold ${state.error ? 'text-cta' : 'text-brand'}`}>
          {state.message}
        </p>
      ) : null}

      <p className="rounded-lg bg-amber-soft px-3 py-2 text-xs leading-relaxed text-amber">
        ملاحظة: إذا سجّلت تكلفة إعلان على مستوى طلب بعينه، فهي التي تُعتمد لذلك الطلب لأنها الأدق.
      </p>
    </form>
  )
}

function SpendForm({ currency }: { currency: string }) {
  const formRef = React.useRef<HTMLFormElement>(null)
  const [state, setState] = React.useState<{ saving: boolean; message: string | null; error: boolean }>({
    saving: false,
    message: null,
    error: false,
  })

  async function save(formData: FormData) {
    setState({ saving: true, message: null, error: false })
    const result = await upsertAdSpend(formData)
    setState({
      saving: false,
      message: result.ok ? 'تم التسجيل.' : (result.error ?? 'تعذّر التسجيل.'),
      error: !result.ok,
    })
    if (result.ok) formRef.current?.reset()
  }

  return (
    <form
      ref={formRef}
      action={save}
      className="space-y-3 rounded-lg border border-line bg-paper-deep/40 p-4"
    >
      <h3 className="text-sm font-black text-ink">تسجيل مصروف إعلاني</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="spend_date" className="block text-xs font-bold text-ink-soft">
            التاريخ
          </label>
          <input
            id="spend_date"
            name="spend_date"
            type="date"
            defaultValue={today()}
            required
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="platform" className="block text-xs font-bold text-ink-soft">
            المنصة
          </label>
          <Select id="platform" name="platform" defaultValue="META">
            {PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="amount" className="block text-xs font-bold text-ink-soft">
          المبلغ ({currency})
        </label>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          dir="ltr"
          placeholder="0.00"
          required
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-start text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="note" className="block text-xs font-bold text-ink-soft">
          ملاحظة
        </label>
        <input
          id="note"
          name="note"
          className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={state.saving}
        className="h-10 w-full rounded-lg bg-brand text-sm font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
      >
        {state.saving ? 'جاري التسجيل…' : 'تسجيل'}
      </button>

      {state.message ? (
        <p className={`text-xs font-bold ${state.error ? 'text-cta' : 'text-brand'}`}>
          {state.message}
        </p>
      ) : null}

      <p className="text-xs leading-relaxed text-ink-muted">
        تسجيل نفس اليوم ونفس المنصة يُحدّث المبلغ السابق بدل إضافته مرة ثانية.
      </p>
    </form>
  )
}

function SpendRow({ entry, currency }: { entry: AdSpend; currency: string }) {
  const [deleting, setDeleting] = React.useState(false)

  async function remove(formData: FormData) {
    setDeleting(true)
    await deleteAdSpend(formData)
    setDeleting(false)
  }

  return (
    <tr>
      <td className="num whitespace-nowrap px-4 py-2.5 text-ink">{entry.spend_date}</td>
      <td className="whitespace-nowrap px-4 py-2.5 text-ink-soft">{entry.platform}</td>
      <td className="num whitespace-nowrap px-4 py-2.5 font-bold text-ink">
        {formatMoney(toCentimes(entry.amount), { currency })}
      </td>
      <td className="px-4 py-2.5 text-ink-muted">{entry.note || '—'}</td>
      <td className="px-4 py-2.5 text-end">
        <form action={remove} className="inline">
          <input type="hidden" name="id" value={entry.id} />
          <button
            type="submit"
            disabled={deleting}
            aria-label={`حذف مصروف ${entry.spend_date}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-cta-soft hover:text-cta disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </form>
      </td>
    </tr>
  )
}
