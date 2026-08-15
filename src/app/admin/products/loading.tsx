import { AdminShell } from '@/components/admin/shell'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProductsLoading() {
  return (
    <AdminShell
      active="/admin/products"
      title="المنتج والإعدادات"
      description="جاري تحميل الإعدادات…"
    >
      <div className="space-y-5">
        {Array.from({ length: 2 }).map((_, card) => (
          <div key={card} className="rounded-card border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <Skeleton className="h-4 w-64" />
              <Skeleton className="mt-2 h-3 w-40" />
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-11 rounded-lg" />
                <Skeleton className="h-11 rounded-lg" />
              </div>
              <div className="rounded-lg border border-line bg-paper-deep/40 p-4">
                <Skeleton className="h-3 w-32" />
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Skeleton className="h-11 rounded-lg" />
                  <Skeleton className="h-11 rounded-lg" />
                  <Skeleton className="h-11 rounded-lg" />
                </div>
              </div>
              <Skeleton className="h-11 w-40 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  )
}
