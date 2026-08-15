'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavProgress } from '@/components/admin/nav-progress'

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number
  pageSize: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startProgress } = useNavProgress()

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  if (pageCount <= 1) return null

  function goTo(next: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (next <= 1) params.delete('page')
    else params.set('page', String(next))
    startProgress()
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <nav className="flex items-center gap-2" aria-label="تنقل بين الصفحات">
      {/* In RTL, "previous" points right and "next" points left. */}
      <button
        type="button"
        onClick={() => goTo(page - 1)}
        disabled={page <= 1}
        aria-label="الصفحة السابقة"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>

      <span className="num px-2 text-sm font-bold text-ink-soft">
        {page} / {pageCount}
      </span>

      <button
        type="button"
        onClick={() => goTo(page + 1)}
        disabled={page >= pageCount}
        aria-label="الصفحة التالية"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:bg-paper-deep disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  )
}
