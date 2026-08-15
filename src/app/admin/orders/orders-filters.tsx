'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/lib/db/types'
import { useNavProgress } from '@/components/admin/nav-progress'

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'الأحدث أولاً' },
  { value: 'created_at:asc', label: 'الأقدم أولاً' },
  { value: 'total_amount:desc', label: 'الأعلى مبلغاً' },
  { value: 'profit:desc', label: 'الأعلى ربحاً' },
  { value: 'customer_name:asc', label: 'اسم الزبون (أ-ي)' },
]

export function OrdersFilters({ sources }: { sources: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startProgress } = useNavProgress()

  const [search, setSearch] = React.useState(searchParams.get('q') ?? '')

  const update = React.useCallback(
    (params: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(params)) {
        if (!value) next.delete(key)
        else next.set(key, value)
      }
      // Any filter change invalidates the current page number.
      next.delete('page')
      startProgress()
      router.push(`${pathname}?${next.toString()}`)
    },
    [pathname, router, searchParams, startProgress],
  )

  // Debounced so typing a phone number does not fire a query per keystroke.
  React.useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (search === current) return

    const timer = setTimeout(() => update({ q: search || null }), 400)
    return () => clearTimeout(timer)
  }, [search, searchParams, update])

  const status = searchParams.get('status') ?? ''
  const source = searchParams.get('source') ?? ''
  const sort = `${searchParams.get('sort') ?? 'created_at'}:${searchParams.get('dir') ?? 'desc'}`

  const hasFilters = Boolean(search || status || source)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-ink-muted"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث برقم الطلب أو الاسم أو الهاتف"
          aria-label="بحث في الطلبات"
          className="h-11 w-full rounded-lg border border-line bg-surface ps-9 pe-3 text-sm text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <Select
        value={status}
        onChange={(e) => update({ status: e.target.value || null })}
        aria-label="تصفية حسب الحالة"
        className="w-auto min-w-36"
      >
        <option value="">كل الحالات</option>
        {ORDER_STATUSES.map((value) => (
          <option key={value} value={value}>
            {ORDER_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>

      {sources.length > 0 ? (
        <Select
          value={source}
          onChange={(e) => update({ source: e.target.value || null })}
          aria-label="تصفية حسب المصدر"
          className="w-auto min-w-32"
        >
          <option value="">كل المصادر</option>
          {sources.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </Select>
      ) : null}

      <Select
        value={sort}
        onChange={(e) => {
          const [sortKey, dir] = e.target.value.split(':')
          update({ sort: sortKey, dir })
        }}
        aria-label="ترتيب"
        className="w-auto min-w-40"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setSearch('')
            startProgress()
            router.push(pathname)
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep"
        >
          <X className="h-4 w-4" aria-hidden />
          إلغاء التصفية
        </button>
      ) : null}
    </div>
  )
}
