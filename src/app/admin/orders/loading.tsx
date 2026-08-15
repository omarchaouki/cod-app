import { AdminShell } from '@/components/admin/shell'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function OrdersLoading() {
  return (
    <AdminShell active="/admin/orders" title="الطلبات" description="جاري تحميل الطلبات…">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-11 min-w-56 flex-1 rounded-lg" />
        <Skeleton className="h-11 w-36 rounded-lg" />
        <Skeleton className="h-11 w-32 rounded-lg" />
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>

      <div className="mt-6">
        <TableSkeleton rows={8} />
      </div>
    </AdminShell>
  )
}
