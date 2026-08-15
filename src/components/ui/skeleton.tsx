import { cn } from '@/lib/utils'

/**
 * Placeholder block used by the admin route skeletons.
 *
 * It reserves the same space the real content will occupy, so the page does
 * not jump when the data arrives — the pulse is there to say "loading", not to
 * decorate.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-line-soft', className)}
      aria-hidden
      {...props}
    />
  )
}

/** A KPI tile placeholder matching the real StatCard's dimensions. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-card border border-line bg-surface p-4 sm:p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  )
}

export function ChartCardSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-56" />
      </div>
      <div className="p-5">
        <Skeleton style={{ height }} className="w-full" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="border-b border-line bg-paper-deep/60 px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-line-soft">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-4 w-28 shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24 shrink-0" />
            <Skeleton className="hidden h-4 w-20 shrink-0 sm:block" />
            <Skeleton className="hidden h-9 w-28 shrink-0 rounded-lg lg:block" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FilterBarSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[64, 56, 88, 96, 80, 96].map((width, index) => (
        <Skeleton key={index} className="h-10 rounded-lg" style={{ width }} />
      ))}
    </div>
  )
}
