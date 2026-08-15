import Link from 'next/link'
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  PhoneMissed,
  ShoppingCart,
} from 'lucide-react'
import { SignOutButton } from './sign-out-button'

const NAV = [
  { href: '/admin/dashboard', label: 'لوحة القيادة', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'الطلبات', icon: ShoppingCart },
  { href: '/admin/abandoned-checkouts', label: 'السلات المتروكة', icon: PhoneMissed },
  { href: '/admin/profitability', label: 'الربحية', icon: BarChart3 },
  { href: '/admin/products', label: 'المنتج والإعدادات', icon: Boxes },
]

/**
 * Admin chrome. A sidebar on desktop, a scrollable tab strip on mobile — the
 * same five destinations either way, so the mental model never changes.
 */
export function AdminShell({
  children,
  title,
  description,
  active,
  actions,
}: {
  children: React.ReactNode
  title: string
  description?: string
  active: string
  actions?: React.ReactNode
}) {
  return (
    <div className="lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-e border-line bg-surface lg:block">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="border-b border-line px-5 py-5">
            <p className="text-base font-black text-ink">دفاتر التربية البدنية</p>
            <p className="mt-0.5 text-xs text-ink-muted">لوحة التحكم</p>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} active={active === item.href} />
            ))}
          </nav>

          <div className="border-t border-line p-3">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile nav */}
        <div className="sticky top-0 z-30 border-b border-line bg-surface lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm font-black text-ink">لوحة التحكم</p>
            <SignOutButton compact />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} active={active === item.href} compact />
            ))}
          </nav>
        </div>

        <main className="p-4 sm:p-6 lg:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-ink">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
              ) : null}
            </div>
            {actions}
          </header>

          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  compact,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center gap-2.5 rounded-lg text-sm font-bold transition-colors',
        compact ? 'shrink-0 px-3 py-2' : 'px-3 py-2.5',
        active ? 'bg-brand text-white' : 'text-ink-soft hover:bg-paper-deep hover:text-ink',
      ].join(' ')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  )
}
