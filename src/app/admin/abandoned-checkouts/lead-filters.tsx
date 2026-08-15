'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from '@/lib/db/types'
import { useNavProgress } from '@/components/admin/nav-progress'

export function LeadFilters({ counts }: { counts: Partial<Record<LeadStatus, number>> }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startProgress } = useNavProgress()

  const [search, setSearch] = React.useState(searchParams.get('q') ?? '')
  const active = searchParams.get('status') ?? ''

  const update = React.useCallback(
    (params: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(params)) {
        if (!value) next.delete(key)
        else next.set(key, value)
      }
      next.delete('page')
      startProgress()
      router.push(`${pathname}?${next.toString()}`)
    },
    [pathname, router, searchParams, startProgress],
  )

  React.useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (search === current) return
    const timer = setTimeout(() => update({ q: search || null }), 400)
    return () => clearTimeout(timer)
  }, [search, searchParams, update])

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-muted"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف"
          aria-label="بحث في السلات المتروكة"
          className="h-11 w-full rounded-lg border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label="الكل" active={!active} onClick={() => update({ status: null })} />
        {LEAD_STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={LEAD_STATUS_LABELS[status]}
            count={counts[status]}
            active={active === status}
            onClick={() => update({ status })}
          />
        ))}
      </div>
    </div>
  )
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-sm font-bold transition-colors',
        active
          ? 'border-brand bg-brand text-white'
          : 'border-line bg-surface text-ink-soft hover:bg-paper-deep',
      ].join(' ')}
    >
      {label}
      {count !== undefined ? (
        <span className={`num text-xs ${active ? 'text-white/80' : 'text-ink-muted'}`}>{count}</span>
      ) : null}
    </button>
  )
}
