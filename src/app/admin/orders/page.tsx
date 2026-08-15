import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminShell } from '@/components/admin/shell'
import { EmptyState } from '@/components/admin/stat-card'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { OrdersFilters } from './orders-filters'
import { OrderRow } from './order-row'
import { Pagination } from './pagination'
import { formatMoney, toCentimes } from '@/lib/money'
import { requireAdmin } from '@/lib/supabase/guard'
import { ORDER_STATUSES, type Order, type OrderStatus, type Settings } from '@/lib/db/types'

export const metadata: Metadata = { title: 'الطلبات' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const SORTABLE = {
  created_at: 'created_at',
  total_amount: 'total_amount',
  profit: 'profit',
  customer_name: 'customer_name',
} as const

type SortKey = keyof typeof SORTABLE

interface Query {
  q?: string
  status?: string
  source?: string
  sort?: string
  dir?: string
  page?: string
}

interface PageProps {
  searchParams: Promise<Query>
}

/**
 * The shell, heading and filter bar render immediately; only the table itself
 * waits on the query. Typing in the search box therefore keeps the controls
 * responsive while the results are being fetched.
 */
export default async function OrdersPage({ searchParams }: PageProps) {
  await requireAdmin()
  const params = await searchParams
  const key = JSON.stringify(params)

  return (
    <AdminShell active="/admin/orders" title="الطلبات">
      <Suspense fallback={<FiltersSkeleton />}>
        <FiltersLoader />
      </Suspense>

      <div className="mt-6">
        <Suspense key={key} fallback={<TableSkeleton rows={8} />}>
          <OrdersTable params={params} />
        </Suspense>
      </div>
    </AdminShell>
  )
}

/** The source list needs its own query, so it streams separately. */
async function FiltersLoader() {
  const { supabase } = await requireAdmin()
  const { data } = await supabase.from('orders').select('source').not('source', 'is', null).limit(500)

  const sources = [
    ...new Set(
      ((data as { source: string | null }[] | null) ?? [])
        .map((row) => row.source)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort()

  return <OrdersFilters sources={sources} />
}

async function OrdersTable({ params }: { params: Query }) {
  const { supabase } = await requireAdmin()

  const search = (params.q ?? '').trim()
  const status = ORDER_STATUSES.includes(params.status as OrderStatus)
    ? (params.status as OrderStatus)
    : null
  const source = (params.source ?? '').trim()
  const sort: SortKey = (params.sort as SortKey) in SORTABLE ? (params.sort as SortKey) : 'created_at'
  const ascending = params.dir === 'asc'
  const page = Math.max(1, Number(params.page) || 1)

  let query = supabase.from('orders').select('*', { count: 'exact' })

  if (status) query = query.eq('status', status)
  if (source) query = query.eq('source', source)

  if (search) {
    // Escape the PostgREST `or` metacharacters so a search for "a,b" cannot
    // rewrite the filter expression.
    const safe = search.replace(/[,()\\]/g, ' ').trim()
    if (safe) {
      query = query.or(
        `order_number.ilike.%${safe}%,customer_name.ilike.%${safe}%,phone.ilike.%${safe}%,address.ilike.%${safe}%`,
      )
    }
  }

  const fromIndex = (page - 1) * PAGE_SIZE

  const [{ data, count, error }, settingsResult] = await Promise.all([
    query.order(SORTABLE[sort], { ascending }).range(fromIndex, fromIndex + PAGE_SIZE - 1),
    supabase.from('settings').select('*').eq('id', true).maybeSingle(),
  ])

  if (error) console.error('[admin/orders]', error.message)

  const orders = (data as Order[] | null) ?? []
  const currency = (settingsResult.data as Settings | null)?.currency ?? 'MAD'
  const total = count ?? 0

  if (orders.length === 0) {
    return <EmptyState message="لا توجد طلبات مطابقة لهذا البحث." />
  }

  const pageRevenue = orders
    .filter((order) => order.status === 'PAID')
    .reduce((sum, order) => sum + toCentimes(order.total_amount), 0)

  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">
        {total} طلب · المعروض في هذه الصفحة: {orders.length}
      </p>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface lg:block">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-paper-deep/60">
            <tr className="text-start">
              <Th>رقم الطلب</Th>
              <Th>الزبون</Th>
              <Th>الهاتف</Th>
              <Th>المبلغ</Th>
              <Th>الربح</Th>
              <Th>المصدر</Th>
              <Th>الحالة</Th>
              <Th>التاريخ</Th>
              <Th> </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} currency={currency} variant="row" />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — a table at 375px is unusable */}
      <div className="space-y-3 lg:hidden">
        {orders.map((order) => (
          <OrderRow key={order.id} order={order} currency={currency} variant="card" />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          مداخيل الطلبات المدفوعة في هذه الصفحة:{' '}
          <span className="num font-bold text-ink">{formatMoney(pageRevenue, { currency })}</span>
        </p>
        <Suspense fallback={null}>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </Suspense>
      </div>
    </>
  )
}

function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-11 min-w-56 flex-1 rounded-lg" />
      <Skeleton className="h-11 w-36 rounded-lg" />
      <Skeleton className="h-11 w-40 rounded-lg" />
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="whitespace-nowrap px-4 py-3 text-start font-bold text-ink-soft">
      {children}
    </th>
  )
}
