import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { EmptyState, SectionCard, StatCard } from '@/components/admin/stat-card'
import {
  CodFunnel,
  OrdersChart,
  ProfitChart,
  RevenueChart,
  SourcesChart,
  StatusChart,
  type DailyPoint,
} from '@/components/admin/charts'
import { centimesToUnits, formatMoney, formatMultiplier, formatPercent, toCentimes } from '@/lib/money'
import { computeCodMetrics, computeProfitability, type DateRange } from '@/lib/metrics'
import {
  getDaily,
  getFunnel,
  getLeadCounts,
  getProfitabilityInputs,
  getSources,
} from '@/lib/reports'
import { requireAdmin } from '@/lib/supabase/guard'
import type { SourceRow } from '@/lib/db/types'

/**
 * Each export below is an independent async section.
 *
 * The dashboard page wraps them in their own <Suspense> boundaries, so the
 * page shell — navigation, heading, date filter — is interactive immediately
 * and every block appears as its own query finishes. A slow funnel query no
 * longer holds up the revenue cards.
 */

/* ------------------------------- headline -------------------------------- */

export async function HeadlineMetrics({ range }: { range: DateRange }) {
  const { supabase } = await requireAdmin()
  const [inputs, funnel] = await Promise.all([
    getProfitabilityInputs(supabase, range),
    getFunnel(supabase, range),
  ])

  const currency = inputs.settings?.currency ?? 'MAD'
  const profit = computeProfitability({
    financials: inputs.financials,
    adSpend: inputs.adSpend,
    defaultCpa: inputs.settings?.default_cpa ?? '0',
    adCostMode: inputs.settings?.ad_cost_mode ?? 'CPA',
    product: inputs.product,
  })
  const cod = computeCodMetrics(funnel)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="المداخيل المدفوعة"
          value={formatMoney(profit.paidRevenue, { currency })}
          hint="الطلبات بحالة «مدفوع» فقط"
          tone="positive"
        />
        <StatCard
          label="الطلبات المدفوعة"
          value={String(profit.paidOrders)}
          hint={`من أصل ${cod.totalOrders} طلب مسجل`}
        />
        <StatCard
          label="الربح الصافي"
          value={formatMoney(profit.netProfit, { currency })}
          hint="بعد كل التكاليف والإعلانات"
          tone={profit.netProfit >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="هامش الربح"
          value={profit.paidOrders > 0 ? formatPercent(profit.profitMargin) : '—'}
          hint="الربح الصافي ÷ المداخيل"
          tone={profit.profitMargin >= 0 ? 'default' : 'negative'}
        />
        <StatCard
          label="متوسط قيمة الطلب"
          value={formatMoney(profit.averageOrderValue, { currency })}
          hint="لكل طلب مدفوع"
        />
        <StatCard
          label="تكلفة اكتساب الزبون"
          value={profit.paidOrders > 0 ? formatMoney(profit.cpa, { currency }) : '—'}
          hint={`السقف المربح: ${formatMoney(profit.maxProfitableCpa, { currency })}`}
          tone="accent"
        />
        <StatCard
          label="ROAS"
          value={profit.advertisingCosts > 0 ? formatMultiplier(profit.roas) : '—'}
          hint={
            profit.advertisingCosts > 0
              ? `نقطة التعادل: ${formatMultiplier(profit.breakEvenRoas)}`
              : 'لم تُسجَّل مصاريف إعلانية'
          }
        />
        <StatCard
          label="نسبة التسليم"
          value={cod.shipped > 0 ? formatPercent(cod.deliveryRate) : '—'}
          hint={`${cod.delivered} مُسلَّم من ${cod.shipped} مشحون`}
        />
      </div>

      <ProfitabilityVerdict
        isProfitable={profit.isProfitable}
        hasPaidOrders={profit.paidOrders > 0}
        headroom={formatMoney(profit.cpaHeadroom, { currency })}
        headroomPositive={profit.cpaHeadroom >= 0}
      />
    </>
  )
}

function ProfitabilityVerdict({
  isProfitable,
  hasPaidOrders,
  headroom,
  headroomPositive,
}: {
  isProfitable: boolean
  hasPaidOrders: boolean
  headroom: string
  headroomPositive: boolean
}) {
  if (!hasPaidOrders) {
    return (
      <div className="mt-5 rounded-card border border-line bg-surface px-5 py-4">
        <p className="text-sm text-ink-muted">
          لا توجد طلبات مدفوعة في هذه الفترة، لذلك لا يمكن حساب الربحية بعد.
        </p>
      </div>
    )
  }

  return (
    <div
      className={`mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border px-5 py-4 ${
        isProfitable ? 'border-brand/25 bg-brand-soft' : 'border-cta/25 bg-cta-soft'
      }`}
    >
      {isProfitable ? (
        <CheckCircle2 className="h-6 w-6 shrink-0 text-brand" aria-hidden />
      ) : (
        <AlertTriangle className="h-6 w-6 shrink-0 text-cta" aria-hidden />
      )}

      <p className={`text-lg font-black ${isProfitable ? 'text-brand-ink' : 'text-cta'}`}>
        {isProfitable ? 'مربح' : 'غير مربح'}
      </p>

      <p className="text-sm text-ink-soft">
        {headroomPositive ? 'الهامش المتبقي في تكلفة الاكتساب' : 'تجاوز في تكلفة الاكتساب'}:{' '}
        <span className="num font-bold text-ink">{headroom}</span> لكل طلب مدفوع
      </p>
    </div>
  )
}

/* -------------------------------- charts --------------------------------- */

export async function TimeSeriesSections({ range }: { range: DateRange }) {
  const { supabase } = await requireAdmin()
  const [daily, inputs] = await Promise.all([
    getDaily(supabase, range),
    getProfitabilityInputs(supabase, range),
  ])

  const currency = inputs.settings?.currency ?? 'MAD'
  const points: DailyPoint[] = daily.map((row) => ({
    day: row.day,
    orders: Number(row.orders_count),
    paid: Number(row.paid_count),
    revenue: centimesToUnits(toCentimes(row.revenue)),
    profit: centimesToUnits(toCentimes(row.profit)),
  }))

  const hasRevenue = points.some((p) => p.revenue !== 0)
  const hasOrders = points.some((p) => p.orders > 0)
  const hasPaid = points.some((p) => p.paid > 0)

  return (
    <>
      <SectionCard
        title="المداخيل عبر الزمن"
        description="محتسبة يوم تحصيل المبلغ، لا يوم تسجيل الطلب"
      >
        {hasRevenue ? (
          <RevenueChart data={points} currency={currency} />
        ) : (
          <EmptyState message="لا توجد مداخيل مدفوعة في هذه الفترة." />
        )}
      </SectionCard>

      <SectionCard title="الطلبات عبر الزمن" description="المسجلة مقابل المدفوعة">
        {hasOrders ? <OrdersChart data={points} /> : <EmptyState message="لا توجد طلبات في هذه الفترة." />}
      </SectionCard>

      <SectionCard title="الربح عبر الزمن" description="بعد خصم التكاليف من الطلبات المدفوعة">
        {hasPaid ? (
          <ProfitChart data={points} currency={currency} />
        ) : (
          <EmptyState message="لا توجد طلبات مدفوعة بعد." />
        )}
      </SectionCard>
    </>
  )
}

/* -------------------------------- funnel --------------------------------- */

export async function FunnelSections({ range }: { range: DateRange }) {
  const { supabase } = await requireAdmin()
  const cod = computeCodMetrics(await getFunnel(supabase, range))
  const hasOrders = cod.totalOrders > 0

  return (
    <>
      <SectionCard title="مسار الطلبات" description="من التسجيل إلى التحصيل">
        {hasOrders ? (
          <CodFunnel
            stages={[
              { label: 'طلبات مسجلة', count: cod.totalOrders, rate: 1, rateLabel: '' },
              {
                label: 'مؤكدة',
                count: cod.confirmed,
                rate: cod.confirmationRate,
                rateLabel: formatPercent(cod.confirmationRate, 0),
              },
              {
                label: 'مشحونة',
                count: cod.shipped,
                rate: cod.shippingRate,
                rateLabel: formatPercent(cod.shippingRate, 0),
              },
              {
                label: 'مُسلَّمة',
                count: cod.delivered,
                rate: cod.deliveryRate,
                rateLabel: formatPercent(cod.deliveryRate, 0),
              },
              {
                label: 'مدفوعة',
                count: cod.paid,
                rate: cod.paidRate,
                rateLabel: formatPercent(cod.paidRate, 0),
              },
            ]}
          />
        ) : (
          <EmptyState message="لا توجد طلبات في هذه الفترة." />
        )}
      </SectionCard>

      <SectionCard title="حالات الطلبات" description="التوزيع الحالي">
        {hasOrders ? (
          <StatusChart
            data={[
              { label: 'مدفوع', value: cod.paid, color: '#15803d' },
              { label: 'مُسلَّم', value: cod.delivered - cod.paid, color: '#0d9488' },
              { label: 'مشحون', value: cod.shipped - cod.delivered, color: '#7c3aed' },
              { label: 'مؤكد', value: cod.confirmed - cod.shipped, color: '#0369a1' },
              { label: 'ملغى', value: cod.cancelled, color: '#b91c1c' },
              { label: 'مرتجع', value: cod.returned, color: '#c2410c' },
              { label: 'فشل التسليم', value: cod.failed, color: '#7f1d1d' },
            ]}
          />
        ) : (
          <EmptyState message="لا توجد طلبات في هذه الفترة." />
        )}
      </SectionCard>
    </>
  )
}

/* -------------------------------- sources -------------------------------- */

export async function SourcesSection({ range }: { range: DateRange }) {
  const { supabase } = await requireAdmin()
  const [sources, settings] = await Promise.all([
    getSources(supabase, range),
    (async () => (await getProfitabilityInputs(supabase, range)).settings)(),
  ])
  const currency = settings?.currency ?? 'MAD'

  return (
    <SectionCard title="مصادر الطلبات" description="من أين تأتي الطلبات">
      {sources.length > 0 ? (
        <SourcesChart currency={currency} data={aggregateSources(sources)} />
      ) : (
        <EmptyState message="لا توجد بيانات مصادر في هذه الفترة." />
      )}
    </SectionCard>
  )
}

/** Collapse (source, campaign) rows into one row per source for the chart. */
function aggregateSources(rows: SourceRow[]) {
  const map = new Map<string, { source: string; orders: number; paid: number; revenue: number }>()

  for (const row of rows) {
    const existing = map.get(row.source) ?? { source: row.source, orders: 0, paid: 0, revenue: 0 }
    existing.orders += Number(row.orders_count)
    existing.paid += Number(row.paid_count)
    existing.revenue += centimesToUnits(toCentimes(row.paid_revenue))
    map.set(row.source, existing)
  }

  return [...map.values()].sort((a, b) => b.orders - a.orders).slice(0, 8)
}

/* ------------------------------- secondary -------------------------------- */

export async function SecondaryMetrics({ range }: { range: DateRange }) {
  const { supabase } = await requireAdmin()
  const [funnel, leads] = await Promise.all([
    getFunnel(supabase, range),
    getLeadCounts(supabase, range),
  ])
  const cod = computeCodMetrics(funnel)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="السلات المتروكة"
          value={String(leads.total)}
          hint={`${leads.new_leads} جديدة تنتظر الاتصال`}
          tone="accent"
        />
        <StatCard
          label="طلبات فاشلة التسليم"
          value={String(cod.failed)}
          hint={cod.totalOrders > 0 ? formatPercent(cod.failedRate) : '—'}
          tone={cod.failed > 0 ? 'negative' : 'default'}
        />
        <StatCard
          label="طلبات ملغاة"
          value={String(cod.cancelled)}
          hint={cod.totalOrders > 0 ? formatPercent(cod.cancellationRate) : '—'}
        />
        <StatCard
          label="طلبات مرتجعة"
          value={String(cod.returned)}
          hint={cod.totalOrders > 0 ? formatPercent(cod.returnRate) : '—'}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/admin/orders"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink transition-colors hover:bg-paper-deep"
        >
          إدارة الطلبات
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <Link
          href="/admin/profitability"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink transition-colors hover:bg-paper-deep"
        >
          تحليل الربحية
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </>
  )
}
