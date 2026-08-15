import { AdminShell } from '@/components/admin/shell'
import {
  ChartCardSkeleton,
  FilterBarSkeleton,
  Skeleton,
  StatCardSkeleton,
} from '@/components/ui/skeleton'

/**
 * Streamed instantly while the dashboard queries run. The shell and navigation
 * stay interactive — only the data area is a placeholder — and every block is
 * the size of the real thing, so nothing shifts when the numbers land.
 */
export default function DashboardLoading() {
  return (
    <AdminShell active="/admin/dashboard" title="لوحة القيادة" description="جاري تحميل البيانات…">
      <FilterBarSkeleton />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>

      <div className="mt-5 rounded-card border border-line bg-surface px-5 py-4">
        <Skeleton className="h-6 w-64" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <ChartCardSkeleton key={index} />
        ))}
      </div>
    </AdminShell>
  )
}
