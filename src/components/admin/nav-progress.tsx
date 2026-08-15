'use client'

import * as React from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * The thin loading bar across the top of the admin.
 *
 * Admin pages are server-rendered against Supabase, so a click can sit for a
 * moment with nothing on screen. The bar is the immediate acknowledgement that
 * the click landed; the per-route `loading.tsx` skeletons take over once the
 * new segment starts streaming.
 *
 * Next 15.1 has no `useLinkStatus`, so navigation is detected two ways:
 *   - a capturing click listener catches any internal <a> before the router
 *     takes over, which covers every sidebar and table link;
 *   - `startProgress()` from the context covers programmatic `router.push`
 *     calls in the filter components.
 *
 * Completion is driven by the pathname/search params actually changing.
 */

interface NavProgressValue {
  startProgress: () => void
  stopProgress: () => void
}

const NavProgressContext = React.createContext<NavProgressValue>({
  startProgress: () => {},
  stopProgress: () => {},
})

export function useNavProgress() {
  return React.useContext(NavProgressContext)
}

export function NavProgress({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [active, setActive] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = React.useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const startProgress = React.useCallback(() => {
    clearTimers()
    setActive(true)
    setProgress(12)

    // Creep toward 90% so the bar always looks like it is doing something,
    // then wait for the real navigation to finish the last stretch.
    const steps: Array<[number, number]> = [
      [120, 35],
      [320, 58],
      [700, 74],
      [1400, 86],
      [2600, 92],
    ]
    for (const [delay, value] of steps) {
      timers.current.push(setTimeout(() => setProgress(value), delay))
    }
  }, [clearTimers])

  const stopProgress = React.useCallback(() => {
    clearTimers()
    setProgress(100)
    // Let the fill animation finish before the bar disappears.
    timers.current.push(
      setTimeout(() => {
        setActive(false)
        setProgress(0)
      }, 220),
    )
  }, [clearTimers])

  // The route actually changed — finish the bar.
  const routeKey = `${pathname}?${searchParams.toString()}`
  const firstRender = React.useRef(true)

  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    stopProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey])

  React.useEffect(() => clearTimers, [clearTimers])

  // Catch internal link clicks before the router handles them.
  React.useEffect(() => {
    function onClick(event: MouseEvent) {
      // Let the browser handle modified clicks — they open new tabs.
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      // Same-page anchors and external links are not navigations we own.
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

      const destination = new URL(anchor.href, window.location.href)
      if (destination.origin !== window.location.origin) return
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) {
        return
      }

      startProgress()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [startProgress])

  const value = React.useMemo(() => ({ startProgress, stopProgress }), [startProgress, stopProgress])

  return (
    <NavProgressContext.Provider value={value}>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
        role="progressbar"
        aria-label="جاري التحميل"
        aria-hidden={!active}
      >
        <div
          className="h-full bg-cta transition-[width,opacity] duration-200 ease-out"
          style={{ width: `${progress}%`, opacity: active ? 1 : 0 }}
        />
      </div>
      {children}
    </NavProgressContext.Provider>
  )
}
