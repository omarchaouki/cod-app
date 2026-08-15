import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AdminShell } from '@/components/admin/shell'
import { EmptyState, StatCard } from '@/components/admin/stat-card'
import { LeadCard } from './lead-card'
import { LeadFilters } from './lead-filters'
import { Pagination } from '../orders/pagination'
import { requireAdmin } from '@/lib/supabase/guard'
import { LEAD_STATUSES, type AbandonedCheckout, type LeadStatus } from '@/lib/db/types'

export const metadata: Metadata = { title: 'السلات المتروكة' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

interface PageProps {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>
}

export default async function AbandonedCheckoutsPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin()
  const params = await searchParams

  const status = LEAD_STATUSES.includes(params.status as LeadStatus)
    ? (params.status as LeadStatus)
    : null
  const search = (params.q ?? '').trim()
  const page = Math.max(1, Number(params.page) || 1)

  let query = supabase.from('abandoned_checkouts').select('*', { count: 'exact' })

  if (status) query = query.eq('status', status)
  if (search) {
    const safe = search.replace(/[,()\\]/g, ' ').trim()
    if (safe) query = query.or(`phone.ilike.%${safe}%,full_name.ilike.%${safe}%`)
  }

  const fromIndex = (page - 1) * PAGE_SIZE

  const [{ data, count, error }, counts] = await Promise.all([
    query.order('created_at', { ascending: false }).range(fromIndex, fromIndex + PAGE_SIZE - 1),
    supabase.from('abandoned_checkouts').select('status'),
  ])

  if (error) console.error('[admin/leads]', error.message)

  const leads = (data as AbandonedCheckout[] | null) ?? []
  const total = count ?? 0

  const allStatuses = ((counts.data as { status: LeadStatus }[] | null) ?? []).reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    },
    {} as Record<LeadStatus, number>,
  )

  const grandTotal = Object.values(allStatuses).reduce((a, b) => a + b, 0)
  const converted = allStatuses.CONVERTED ?? 0

  return (
    <AdminShell
      active="/admin/abandoned-checkouts"
      title="السلات المتروكة"
      description="زوار أدخلوا رقم هاتف صحيح ولم يكملوا الطلب. هذه ليست طلبات ولا تُحتسب ضمن المداخيل."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="مجموع السلات" value={String(grandTotal)} hint="كل الفترات" />
        <StatCard
          label="جديدة"
          value={String(allStatuses.NEW ?? 0)}
          hint="تنتظر الاتصال"
          tone="accent"
        />
        <StatCard label="تم الاتصال" value={String(allStatuses.CONTACTED ?? 0)} />
        <StatCard
          label="تحوّلت إلى طلب"
          value={String(converted)}
          hint={grandTotal > 0 ? `${Math.round((converted / grandTotal) * 100)}% من السلات` : '—'}
          tone="positive"
        />
      </div>

      <div className="mt-6">
        <Suspense fallback={<div className="h-12" />}>
          <LeadFilters counts={allStatuses} />
        </Suspense>
      </div>

      {leads.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="لا توجد سلات متروكة مطابقة." />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <Suspense fallback={null}>
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
            </Suspense>
          </div>
        </>
      )}
    </AdminShell>
  )
}
