'use client'

import * as React from 'react'

/**
 * Mobile-only sticky order bar.
 *
 * Appears once the hero has scrolled away and hides again when the order form
 * itself is on screen — a bar that covers the form it points to is worse than
 * no bar. Uses IntersectionObserver rather than scroll listeners so it costs
 * nothing on the main thread.
 */
export function StickyCta({ priceLabel }: { priceLabel: string }) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const hero = document.getElementById('top')
    const order = document.getElementById('order')
    if (!hero || !order) return

    let heroPassed = false
    let orderVisible = false

    const update = () => setVisible(heroPassed && !orderVisible)

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        heroPassed = !entry.isIntersecting
        update()
      },
      { threshold: 0 },
    )

    const orderObserver = new IntersectionObserver(
      ([entry]) => {
        orderVisible = entry.isIntersecting
        update()
      },
      { threshold: 0 },
    )

    heroObserver.observe(hero)
    orderObserver.observe(order)

    return () => {
      heroObserver.disconnect()
      orderObserver.disconnect()
    }
  }, [])

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur-sm transition-transform duration-200 md:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      /* pb-safe keeps the button clear of the iOS home indicator. */
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-muted">الدفع عند الاستلام</p>
          <p className="num text-lg font-black leading-tight text-ink">{priceLabel}</p>
        </div>

        <a
          href="#order"
          tabIndex={visible ? 0 : -1}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-cta px-6 text-base font-bold text-white"
        >
          اطلب الآن
        </a>
      </div>
    </div>
  )
}
