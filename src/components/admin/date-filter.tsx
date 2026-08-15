'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { RANGE_LABELS } from '@/lib/metrics'
import { useNavProgress } from '@/components/admin/nav-progress'

const PRESETS = Object.entries(RANGE_LABELS) as Array<[keyof typeof RANGE_LABELS, string]>

/**
 * Date range filter. The selection lives in the URL, so a filtered dashboard
 * can be bookmarked, shared and reloaded without losing its state.
 */
export function DateFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startProgress } = useNavProgress()

  const currentRange = searchParams.get('range') ?? 'last30'
  const [showCustom, setShowCustom] = React.useState(currentRange === 'custom')
  const [from, setFrom] = React.useState(searchParams.get('from') ?? '')
  const [to, setTo] = React.useState(searchParams.get('to') ?? '')

  function apply(params: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(params)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    // Filtering should not reset the reader to page 5 of a shorter list.
    next.delete('page')
    startProgress()
    router.push(`${pathname}?${next.toString()}`)
  }

  function selectPreset(key: string) {
    setShowCustom(false)
    apply({ range: key, from: null, to: null })
  }

  function applyCustom(event: React.FormEvent) {
    event.preventDefault()
    if (!from || !to) return
    apply({ range: 'custom', from, to })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => selectPreset(key)}
            aria-pressed={currentRange === key}
            className={[
              'h-10 rounded-lg border px-3.5 text-sm font-bold transition-colors',
              currentRange === key
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-ink-soft hover:bg-paper-deep',
            ].join(' ')}
          >
            {label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          aria-pressed={currentRange === 'custom'}
          aria-expanded={showCustom}
          className={[
            'h-10 rounded-lg border px-3.5 text-sm font-bold transition-colors',
            currentRange === 'custom'
              ? 'border-brand bg-brand text-white'
              : 'border-line bg-surface text-ink-soft hover:bg-paper-deep',
          ].join(' ')}
        >
          فترة محددة
        </button>
      </div>

      {showCustom ? (
        <form
          onSubmit={applyCustom}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3"
        >
          <div className="space-y-1">
            <label htmlFor="range-from" className="block text-xs font-bold text-ink-muted">
              من
            </label>
            <input
              id="range-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="range-to" className="block text-xs font-bold text-ink-muted">
              إلى
            </label>
            <input
              id="range-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-ink"
              required
            />
          </div>

          <button
            type="submit"
            className="h-10 rounded-lg bg-brand px-4 text-sm font-bold text-white transition-colors hover:bg-brand-ink"
          >
            تطبيق
          </button>
        </form>
      ) : null}
    </div>
  )
}
