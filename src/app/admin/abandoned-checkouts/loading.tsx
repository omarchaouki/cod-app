import { AdminShell } from '@/components/admin/shell'
import { FilterBarSkeleton, Skeleton, StatCardSkeleton } from '@/components/ui/skeleton'

export default function AbandonedCheckoutsLoading() {
  return (
    <AdminShell
      active="/admin/abandoned-checkouts"
      title="السلات المتروكة"
      description="جاري تحميل السلات…"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <Skeleton className="h-11 max-w-sm rounded-lg" />
        <FilterBarSkeleton />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-card border border-line bg-surface p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-3 w-24" />
            <Skeleton className="mt-3 h-11 w-full rounded-lg" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-2/3" />
            <Skeleton className="mt-4 h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
