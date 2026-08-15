import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminShell } from '@/components/admin/shell'
import { DateFilter } from '@/components/admin/date-filter'
import { ChartCardSkeleton, Skeleton, StatCardSkeleton } from '@/components/ui/skeleton'
import { resolveRange } from '@/lib/metrics'
import { requireAdmin } from '@/lib/supabase/guard'
import {
  FunnelSections,
  HeadlineMetrics,
  SecondaryMetrics,
  SourcesSection,
  TimeSeriesSections,
} from './sections'

export const metadata: Metadata = { title: 'لوحة القيادة' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

/**
 * The page itself awaits nothing but the search params, so the shell, the
 * heading and the date filter render and become interactive straight away.
 * Every data block below sits behind its own <Suspense> and streams in when
 * its query resolves — the revenue cards do not wait for the charts, and the
 * charts do not wait for the marketing sources.
 *
 * The `key` on each boundary is the resolved range, so changing the date
 * filter drops back to skeletons for the sections being refetched instead of
 * showing last period's numbers as though they were current.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  // Authorise before any admin chrome is emitted. `requireAdmin` is wrapped in
  // React's cache(), so the streamed sections below reuse this same check
  // rather than each paying for another auth round trip.
  await requireAdmin()

  const params = await searchParams
  const range = resolveRange(params.range, params.from, params.to)
  const key = `${range.key}:${range.from.toISOString()}:${range.to.toISOString()}`

  return (
    <AdminShell
      active="/admin/dashboard"
      title="لوحة القيادة"
      description={`الفترة: ${range.label} · المداخيل تحتسب من الطلبات المدفوعة فقط`}
    >
      <Suspense fallback={<div className="h-12" />}>
        <DateFilter />
      </Suspense>

      <div className="mt-6">
        <Suspense key={`headline-${key}`} fallback={<HeadlineSkeleton />}>
          <HeadlineMetrics range={range} />
        </Suspense>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Suspense
          key={`series-${key}`}
          fallback={
            <>
              <ChartCardSkeleton />
              <ChartCardSkeleton />
              <ChartCardSkeleton />
            </>
          }
        >
          <TimeSeriesSections range={range} />
        </Suspense>

        <Suspense
          key={`funnel-${key}`}
          fallback={
            <>
              <ChartCardSkeleton height={200} />
              <ChartCardSkeleton height={200} />
            </>
          }
        >
          <FunnelSections range={range} />
        </Suspense>

        <Suspense key={`sources-${key}`} fallback={<ChartCardSkeleton height={200} />}>
          <SourcesSection range={range} />
        </Suspense>
      </div>

      <div className="mt-5">
        <Suspense key={`secondary-${key}`} fallback={<SecondarySkeleton />}>
          <SecondaryMetrics range={range} />
        </Suspense>
      </div>
    </AdminShell>
  )
}

function HeadlineSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <div className="mt-5 rounded-card border border-line bg-surface px-5 py-4">
        <Skeleton className="h-6 w-64" />
      </div>
    </>
  )
}

function SecondarySkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Skeleton className="h-11 w-36 rounded-lg" />
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>
    </>
  )
}
