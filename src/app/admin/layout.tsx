import type { Metadata } from 'next'
import { Suspense } from 'react'
import { NavProgress } from '@/components/admin/nav-progress'

export const metadata: Metadata = {
  title: { default: 'لوحة التحكم', template: '%s | لوحة التحكم' },
  // The admin must never be indexed, whatever a crawler is told elsewhere.
  robots: { index: false, follow: false, nocache: true },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper-deep">
      {/* NavProgress reads useSearchParams, so it needs a Suspense boundary to
          avoid opting the whole admin subtree into client-side rendering. */}
      <Suspense fallback={children}>
        <NavProgress>{children}</NavProgress>
      </Suspense>
    </div>
  )
}
