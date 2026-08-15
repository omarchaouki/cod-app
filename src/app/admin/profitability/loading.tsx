import { AdminShell } from '@/components/admin/shell'
import { FilterBarSkeleton, Skeleton, StatCardSkeleton } from '@/components/ui/skeleton'

export default function ProfitabilityLoading() {
  return (
    <AdminShell active="/admin/profitability" title="الربحية" description="جاري حساب الأرقام…">
      <FilterBarSkeleton />

      <div className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="mt-2 h-4 w-40" />
            </div>
          </div>
          <div className="min-w-64 flex-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="rounded-card border border-line bg-surface">
          <div className="border-b border-line px-5 py-4">
            <Skeleton className="h-4 w-44" />
          </div>
          <div className="space-y-4 p-5">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
