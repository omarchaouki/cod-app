'use client'

import * as React from 'react'
import { SectionCard } from '@/components/admin/stat-card'
import { Select } from '@/components/ui/select'
import type { Settings } from '@/lib/db/types'
import { updateSettings } from '../actions'

export function StoreSettingsForm({
  settings,
  currency,
}: {
  settings: Settings
  currency: string
}) {
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
    <SectionCard title="إعدادات المتجر" description="تظهر في صفحة البيع وفي حسابات الربحية">
      <form action={save} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="store_name" className="block text-xs font-bold text-ink-soft">
              اسم المتجر
            </label>
            <input
              id="store_name"
              name="store_name"
              defaultValue={settings.store_name}
              required
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="store_phone" className="block text-xs font-bold text-ink-soft">
              هاتف المتجر
            </label>
            <input
              id="store_phone"
              name="store_phone"
              dir="ltr"
              defaultValue={settings.store_phone ?? ''}
              placeholder="06 12 34 56 78"
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-start text-sm"
            />
            <p className="text-xs text-ink-muted">يظهر في تذييل صفحة البيع. اتركه فارغاً لإخفائه.</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings_ad_mode" className="block text-xs font-bold text-ink-soft">
              طريقة احتساب المصاريف الإعلانية
            </label>
            <Select
              id="settings_ad_mode"
              name="ad_cost_mode"
              defaultValue={settings.ad_cost_mode}
              className="h-11"
            >
              <option value="CPA">تكلفة ثابتة لكل طلب (CPA)</option>
              <option value="AD_SPEND">المصاريف الفعلية المسجَّلة</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings_cpa" className="block text-xs font-bold text-ink-soft">
              تكلفة الاكتساب الافتراضية ({currency})
            </label>
            <input
              id="settings_cpa"
              name="default_cpa"
              inputMode="decimal"
              dir="ltr"
              defaultValue={String(settings.default_cpa)}
              required
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-start text-sm tabular-nums"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={state.saving}
            className="h-11 rounded-lg bg-brand px-6 text-sm font-bold text-white transition-colors hover:bg-brand-ink disabled:opacity-50"
          >
            {state.saving ? 'جاري الحفظ…' : 'حفظ الإعدادات'}
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
