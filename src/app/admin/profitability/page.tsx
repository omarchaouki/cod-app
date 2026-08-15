import type { Metadata } from 'next'
import { Suspense } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AdminShell } from '@/components/admin/shell'
import { DateFilter } from '@/components/admin/date-filter'
import { CpaGauge } from '@/components/admin/charts'
import { SectionCard, StatCard } from '@/components/admin/stat-card'
import { AdSpendPanel } from './ad-spend-panel'
import { centimesToUnits, formatMoney, formatMultiplier, formatPercent, toCentimes } from '@/lib/money'
import { computeCodMetrics, computeProfitability, resolveRange } from '@/lib/metrics'
import { getFunnel, getProfitabilityInputs } from '@/lib/reports'
import { requireAdmin } from '@/lib/supabase/guard'
import type { AdSpend } from '@/lib/db/types'

export const metadata: Metadata = { title: 'الربحية' }
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export default async function ProfitabilityPage({ searchParams }: PageProps) {
  const { supabase } = await requireAdmin()
  const params = await searchParams
  const range = resolveRange(params.range, params.from, params.to)

  const [reports, funnel, adSpendRows] = await Promise.all([
    getProfitabilityInputs(supabase, range),
    getFunnel(supabase, range),
    supabase
      .from('ad_spend')
      .select('*')
      .order('spend_date', { ascending: false })
      .limit(20),
  ])

  const currency = reports.settings?.currency ?? 'MAD'

  const profit = computeProfitability({
    financials: reports.financials,
    adSpend: reports.adSpend,
    defaultCpa: reports.settings?.default_cpa ?? '0',
    adCostMode: reports.settings?.ad_cost_mode ?? 'CPA',
    product: reports.product,
  })

  const cod = computeCodMetrics(funnel)
  const unit = profit.unitEconomics

  const money = (centimes: number) => formatMoney(centimes, { currency })

  return (
    <AdminShell
      active="/admin/profitability"
      title="الربحية"
      description={`الفترة: ${range.label} · كل الأرقام محسوبة من الطلبات المدفوعة فعلياً`}
    >
      <Suspense fallback={<div className="h-12" />}>
        <DateFilter />
      </Suspense>

      {/* --------------------------- the verdict --------------------------- */}
      <section
        className={`mt-6 rounded-card border p-5 sm:p-6 ${
          profit.paidOrders === 0
            ? 'border-line bg-surface'
            : profit.isProfitable
              ? 'border-brand/25 bg-brand-soft'
              : 'border-cta/25 bg-cta-soft'
        }`}
      >
        {profit.paidOrders === 0 ? (
          <p className="text-sm text-ink-muted">
            لا توجد طلبات مدفوعة في هذه الفترة. لا يمكن حساب الربحية قبل تحصيل أول مبلغ.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <div className="flex items-center gap-3">
              {profit.isProfitable ? (
                <CheckCircle2 className="h-9 w-9 shrink-0 text-brand" aria-hidden />
              ) : (
                <AlertTriangle className="h-9 w-9 shrink-0 text-cta" aria-hidden />
              )}
              <div>
                <p
                  className={`text-2xl font-black ${
                    profit.isProfitable ? 'text-brand-ink' : 'text-cta'
                  }`}
                >
                  {profit.isProfitable ? 'مربح' : 'غير مربح'}
                </p>
                <p className="text-sm text-ink-soft">
                  الربح الصافي:{' '}
                  <span className="num font-bold">{money(profit.netProfit)}</span>
                </p>
              </div>
            </div>

            <div className="min-w-64 flex-1">
              <CpaGauge
                cpa={centimesToUnits(profit.cpa)}
                maxCpa={centimesToUnits(profit.maxProfitableCpa)}
                currency={currency}
              />
            </div>
          </div>
        )}
      </section>

      {/* -------------------------- the P&L ladder ------------------------- */}
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <SectionCard
          title="حساب الأرباح والخسائر"
          description="المداخيل ناقص كل التكاليف"
        >
          <dl className="divide-y divide-line-soft">
            <LedgerRow label="المداخيل المدفوعة" value={money(profit.paidRevenue)} strong positive />
            <LedgerRow label="تكلفة المنتج" value={`− ${money(profit.productCosts)}`} />
            <LedgerRow label="تكلفة النقل والتوصيل" value={`− ${money(profit.transportCosts)}`} />
            <LedgerRow label="المصاريف الإعلانية" value={`− ${money(profit.advertisingCosts)}`} />
            <LedgerRow label="تكاليف أخرى" value={`− ${money(profit.otherCosts)}`} />
            <LedgerRow
              label="مجموع التكاليف"
              value={money(profit.totalCosts)}
              muted
            />
            <LedgerRow
              label="الربح الصافي"
              value={money(profit.netProfit)}
              strong
              positive={profit.netProfit >= 0}
              negative={profit.netProfit < 0}
            />
          </dl>

          <p className="mt-4 rounded-lg bg-paper-deep px-4 py-3 text-xs leading-relaxed text-ink-muted">
            المداخيل تشمل الطلبات ذات الحالة «مدفوع» فقط، محتسبة بتاريخ التحصيل. الطلبات المسجلة
            أو المؤكدة أو المشحونة أو حتى المسلَّمة لا تدخل في هذا الحساب.
          </p>
        </SectionCard>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="الطلبات المدفوعة"
            value={String(profit.paidOrders)}
            hint={`${profit.paidUnits} نسخة مباعة`}
          />
          <StatCard
            label="متوسط قيمة الطلب"
            value={money(profit.averageOrderValue)}
            hint="AOV"
          />
          <StatCard
            label="متوسط الربح للطلب"
            value={money(profit.averageProfitPerPaidOrder)}
            tone={profit.averageProfitPerPaidOrder >= 0 ? 'positive' : 'negative'}
          />
          <StatCard
            label="هامش الربح"
            value={profit.paidOrders > 0 ? formatPercent(profit.profitMargin) : '—'}
          />
          <StatCard
            label="تكلفة الاكتساب (CPA)"
            value={profit.paidOrders > 0 ? money(profit.cpa) : '—'}
            hint="المصاريف الإعلانية ÷ الطلبات المدفوعة"
            tone="accent"
          />
          <StatCard
            label="أقصى CPA مربح"
            value={money(profit.maxProfitableCpa)}
            hint="السقف قبل الخسارة"
          />
          <StatCard
            label="ROAS"
            value={profit.advertisingCosts > 0 ? formatMultiplier(profit.roas) : '—'}
            hint="المداخيل ÷ المصاريف الإعلانية"
          />
          <StatCard
            label="ROAS نقطة التعادل"
            value={profit.paidOrders > 0 ? formatMultiplier(profit.breakEvenRoas) : '—'}
            hint="أقل ROAS دون خسارة"
          />
        </div>
      </div>

      {/* --------------------------- unit economics ------------------------ */}
      {unit ? (
        <div className="mt-5">
          <SectionCard
            title="اقتصاديات الوحدة"
            description="محسوبة من أسعار وتكاليف المنتج الحالية، بغض النظر عن المبيعات"
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <dl className="divide-y divide-line-soft">
                <LedgerRow label="سعر البيع" value={money(unit.sellingPrice)} strong positive />
                <LedgerRow label="تكلفة المنتج" value={`− ${money(unit.productCost)}`} />
                <LedgerRow label="تكلفة التوصيل" value={`− ${money(unit.transportCost)}`} />
                <LedgerRow label="تكاليف أخرى" value={`− ${money(unit.otherCost)}`} />
                <LedgerRow
                  label="الهامش المتاح للإعلان"
                  value={money(unit.contributionMargin)}
                  strong
                  positive={unit.contributionMargin >= 0}
                  negative={unit.contributionMargin < 0}
                />
              </dl>

              <div className="rounded-lg border border-line bg-paper-deep/50 p-5">
                <p className="text-sm font-bold text-ink">ماذا يعني هذا الرقم</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  كل طلب مدفوع يترك{' '}
                  <span className="num font-black text-ink">
                    {money(unit.contributionMargin)}
                  </span>{' '}
                  بعد خصم تكلفة المنتج والتوصيل والتكاليف الأخرى. هذا هو أقصى مبلغ يمكن إنفاقه في
                  الإعلانات لجلب طلب واحد مدفوع دون خسارة.
                </p>

                <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                  إذا كانت تكلفة الاكتساب أقل من هذا السقف، فالحملة مربحة. إذا تجاوزته، فكل طلب
                  إضافي يزيد الخسارة.
                </p>

                {profit.paidOrders > 0 ? (
                  <p
                    className={`mt-4 rounded-lg px-4 py-3 text-sm font-bold ${
                      profit.cpaHeadroom >= 0
                        ? 'bg-brand-soft text-brand-ink'
                        : 'bg-cta-soft text-cta'
                    }`}
                  >
                    {profit.cpaHeadroom >= 0
                      ? `يمكنك زيادة تكلفة الاكتساب بـ ${money(profit.cpaHeadroom)} قبل بلوغ نقطة التعادل.`
                      : `تكلفة الاكتساب تتجاوز السقف بـ ${money(Math.abs(profit.cpaHeadroom))} لكل طلب.`}
                  </p>
                ) : null}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {/* ----------------------------- COD rates --------------------------- */}
      <div className="mt-5">
        <SectionCard
          title="مؤشرات الدفع عند الاستلام"
          description="محسوبة من الحالات الفعلية للطلبات المسجلة في الفترة"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="مجموع الطلبات" value={String(cod.totalOrders)} />
            <StatCard
              label="نسبة التأكيد"
              value={cod.totalOrders > 0 ? formatPercent(cod.confirmationRate) : '—'}
              hint={`${cod.confirmed} من ${cod.totalOrders}`}
            />
            <StatCard
              label="نسبة الشحن"
              value={cod.confirmed > 0 ? formatPercent(cod.shippingRate) : '—'}
              hint={`${cod.shipped} من ${cod.confirmed} مؤكد`}
            />
            <StatCard
              label="نسبة التسليم"
              value={cod.shipped > 0 ? formatPercent(cod.deliveryRate) : '—'}
              hint={`${cod.delivered} من ${cod.shipped} مشحون`}
            />
            <StatCard
              label="نسبة التحصيل"
              value={cod.totalOrders > 0 ? formatPercent(cod.paidRate) : '—'}
              hint={`${cod.paid} من ${cod.totalOrders}`}
              tone="positive"
            />
            <StatCard
              label="نسبة الإلغاء"
              value={cod.totalOrders > 0 ? formatPercent(cod.cancellationRate) : '—'}
              hint={`${cod.cancelled} طلب`}
            />
            <StatCard
              label="نسبة الإرجاع"
              value={cod.totalOrders > 0 ? formatPercent(cod.returnRate) : '—'}
              hint={`${cod.returned} طلب`}
            />
            <StatCard
              label="نسبة فشل التسليم"
              value={cod.totalOrders > 0 ? formatPercent(cod.failedRate) : '—'}
              hint={`${cod.failed} طلب`}
              tone={cod.failed > 0 ? 'negative' : 'default'}
            />
          </div>
        </SectionCard>
      </div>

      {/* -------------------------- advertising spend ---------------------- */}
      <div className="mt-5">
        <AdSpendPanel
          entries={(adSpendRows.data as AdSpend[] | null) ?? []}
          currency={currency}
          adCostMode={reports.settings?.ad_cost_mode ?? 'CPA'}
          defaultCpa={reports.settings?.default_cpa ?? '0'}
          storeName={reports.settings?.store_name ?? 'دفاتر التربية البدنية'}
          storePhone={reports.settings?.store_phone ?? null}
          periodTotal={money(toCentimes(reports.adSpend.total))}
          periodEntries={Number(reports.adSpend.entries)}
        />
      </div>
    </AdminShell>
  )
}

function LedgerRow({
  label,
  value,
  strong,
  muted,
  positive,
  negative,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
  positive?: boolean
  negative?: boolean
}) {
  const tone = negative ? 'text-cta' : positive ? 'text-brand' : muted ? 'text-ink-muted' : 'text-ink'

  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className={`text-sm ${strong ? 'font-bold text-ink' : 'text-ink-soft'}`}>{label}</dt>
      <dd className={`num text-end ${strong ? 'text-lg font-black' : 'font-bold'} ${tone}`}>
        {value}
      </dd>
    </div>
  )
}
