import { cn } from '@/lib/utils'

/**
 * A KPI tile. The value is always the loudest thing in the card, the label
 * explains it, and the hint carries the denominator or the comparison — so no
 * number on the dashboard is ambiguous about what it counts.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'positive' | 'negative' | 'accent'
  className?: string
}) {
  const toneClass = {
    default: 'text-ink',
    positive: 'text-brand',
    negative: 'text-cta',
    accent: 'text-amber',
  }[tone]

  return (
    <div className={cn('rounded-card border border-line bg-surface p-4 sm:p-5', className)}>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className={cn('num mt-2 text-2xl font-black leading-tight sm:text-[1.75rem]', toneClass)}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{hint}</p> : null}
    </div>
  )
}

export function SectionCard({
  title,
  description,
  children,
  actions,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-card border border-line bg-surface', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-base font-black text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-line bg-paper-deep/50 px-5 py-8">
      <p className="text-center text-sm text-ink-muted">{message}</p>
    </div>
  )
}
