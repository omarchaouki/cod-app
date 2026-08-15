'use client'

import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatMoney, formatPercent } from '@/lib/money'

/**
 * Dashboard charts.
 *
 * Two RTL decisions run through all of them:
 *   - the Y axis sits on the right, where an Arabic reader's eye starts;
 *   - the time axis still runs left → right, because reversing a time series
 *     is the one mirroring that actively confuses people.
 *
 * Colours come from the same token set as the rest of the app, and every
 * series is also labelled in its tooltip — colour never carries meaning alone.
 */

const INK_MUTED = '#78716c'
const BRAND = '#14532d'
const AMBER = '#b45309'

const AXIS = { stroke: 'transparent', tick: { fill: INK_MUTED, fontSize: 12 } } as const

/** Renders a short Arabic day label like "12/03". */
function dayLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

function ChartFrame({ children, height = 260 }: { children: React.ReactElement; height?: number }) {
  return (
    // A fixed height reserves the space before the chart mounts, so the page
    // does not shift when Recharts hydrates.
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e7ddcb',
    background: '#ffffff',
    fontSize: 13,
    fontWeight: 600,
    boxShadow: '0 4px 12px rgb(28 25 23 / 0.08)',
  },
  labelStyle: { color: INK_MUTED, marginBottom: 4, fontWeight: 500 },
} as const

/* ========================================================================== *
 * Revenue over time
 * ========================================================================== */

export interface DailyPoint {
  day: string
  orders: number
  paid: number
  revenue: number
  profit: number
}

export function RevenueChart({ data, currency }: { data: DailyPoint[]; currency: string }) {
  return (
    <ChartFrame>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayLabel} {...AXIS} minTickGap={24} />
        <YAxis orientation="right" width={64} {...AXIS} tickFormatter={(v: number) => String(v)} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(value) => dayLabel(String(value))}
          formatter={(value: number) => [formatMoney(value * 100, { currency }), 'مداخيل مدفوعة']}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="مداخيل مدفوعة"
          stroke={BRAND}
          strokeWidth={2.5}
          fill="url(#revenueFill)"
        />
      </AreaChart>
    </ChartFrame>
  )
}

/* ========================================================================== *
 * Orders over time — placed vs paid
 * ========================================================================== */

export function OrdersChart({ data }: { data: DailyPoint[] }) {
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayLabel} {...AXIS} minTickGap={24} />
        <YAxis orientation="right" width={40} allowDecimals={false} {...AXIS} />
        <Tooltip {...tooltipStyle} labelFormatter={(value) => dayLabel(String(value))} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="orders" name="طلبات مسجلة" fill={AMBER} radius={[3, 3, 0, 0]} />
        <Bar dataKey="paid" name="طلبات مدفوعة" fill={BRAND} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartFrame>
  )
}

/* ========================================================================== *
 * Profit over time
 * ========================================================================== */

export function ProfitChart({ data, currency }: { data: DailyPoint[]; currency: string }) {
  return (
    <ChartFrame>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tickFormatter={dayLabel} {...AXIS} minTickGap={24} />
        <YAxis orientation="right" width={64} {...AXIS} />
        <Tooltip
          {...tooltipStyle}
          labelFormatter={(value) => dayLabel(String(value))}
          formatter={(value: number) => [formatMoney(value * 100, { currency }), 'الربح الصافي']}
        />
        <Line
          type="monotone"
          dataKey="profit"
          name="الربح الصافي"
          stroke={AMBER}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartFrame>
  )
}

/* ========================================================================== *
 * COD funnel
 *
 * A horizontal bar funnel rather than a pie: the stages are sequential, and
 * the number that matters is the drop-off between them. Each stage prints its
 * own count and conversion percentage as text, so the chart is readable
 * without relying on the bar lengths at all.
 * ========================================================================== */

export interface FunnelStage {
  label: string
  count: number
  /** Conversion against the previous stage. */
  rate: number
  rateLabel: string
}

export function CodFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)

  return (
    <ol className="space-y-3">
      {stages.map((stage, index) => {
        const width = Math.max((stage.count / max) * 100, stage.count > 0 ? 4 : 0)
        return (
          <li key={stage.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-bold text-ink">{stage.label}</span>
              <span className="num tabular text-ink-muted">
                <span className="font-black text-ink">{stage.count}</span>
                {index > 0 ? <span className="ms-2">{stage.rateLabel}</span> : null}
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-paper-deep">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${width}%`, opacity: 1 - index * 0.11 }}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ========================================================================== *
 * Status breakdown
 * ========================================================================== */

export interface StatusSlice {
  label: string
  value: number
  color: string
}

export function StatusChart({ data }: { data: StatusSlice[] }) {
  const rows = data.filter((d) => d.value > 0)
  if (rows.length === 0) return null

  return (
    <ChartFrame height={Math.max(200, rows.length * 42)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} />
        <YAxis
          type="category"
          dataKey="label"
          orientation="right"
          width={86}
          {...AXIS}
        />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [value, 'عدد الطلبات']} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
          {rows.map((row) => (
            <Cell key={row.label} fill={row.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  )
}

/* ========================================================================== *
 * Marketing sources
 * ========================================================================== */

export interface SourcePoint {
  source: string
  orders: number
  paid: number
  revenue: number
}

export function SourcesChart({ data, currency }: { data: SourcePoint[]; currency: string }) {
  return (
    <ChartFrame height={Math.max(200, data.length * 52)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...AXIS} />
        <YAxis type="category" dataKey="source" orientation="right" width={86} {...AXIS} />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number, name: string) =>
            name === 'مداخيل مدفوعة'
              ? [formatMoney(value * 100, { currency }), name]
              : [value, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        <Bar dataKey="orders" name="طلبات" fill={AMBER} radius={[0, 3, 3, 0]} barSize={12} />
        <Bar dataKey="paid" name="مدفوعة" fill={BRAND} radius={[0, 3, 3, 0]} barSize={12} />
      </BarChart>
    </ChartFrame>
  )
}

/* ========================================================================== *
 * CPA vs the profitability ceiling
 *
 * A bullet chart: one bar for what an acquisition currently costs, against the
 * marker for the most it could cost before the business stops making money.
 * ========================================================================== */

export function CpaGauge({
  cpa,
  maxCpa,
  currency,
}: {
  cpa: number
  maxCpa: number
  currency: string
}) {
  const scale = Math.max(cpa, maxCpa, 1) * 1.15
  const cpaWidth = Math.min((cpa / scale) * 100, 100)
  const maxWidth = Math.min((maxCpa / scale) * 100, 100)
  const withinBudget = maxCpa > 0 && cpa <= maxCpa
  const usage = maxCpa > 0 ? cpa / maxCpa : 0

  return (
    <div>
      <div className="relative h-9 w-full overflow-hidden rounded-lg bg-paper-deep">
        {/* Everything up to the ceiling is the profitable zone. */}
        <div
          className="absolute inset-y-0 start-0 bg-brand-soft"
          style={{ width: `${maxWidth}%` }}
          aria-hidden
        />
        <div
          className={`absolute inset-y-1.5 start-0 rounded-md ${withinBudget ? 'bg-brand' : 'bg-cta'}`}
          style={{ width: `${cpaWidth}%` }}
          aria-hidden
        />
        {/* The ceiling marker */}
        <div
          className="absolute inset-y-0 w-0.5 bg-ink"
          style={{ insetInlineStart: `${maxWidth}%` }}
          aria-hidden
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${withinBudget ? 'bg-brand' : 'bg-cta'}`}
            aria-hidden
          />
          <span className="text-ink-soft">التكلفة الحالية</span>
          <span className="num font-black text-ink">{formatMoney(cpa * 100, { currency })}</span>
        </span>

        <span className="flex items-center gap-2">
          <span className="h-3 w-0.5 bg-ink" aria-hidden />
          <span className="text-ink-soft">السقف المربح</span>
          <span className="num font-black text-ink">{formatMoney(maxCpa * 100, { currency })}</span>
        </span>
      </div>

      {maxCpa > 0 ? (
        <p className="mt-2 text-xs text-ink-muted">
          تستهلك <span className="num font-bold">{formatPercent(usage, 0)}</span> من السقف المربح
          لكل طلب مدفوع.
        </p>
      ) : null}
    </div>
  )
}
