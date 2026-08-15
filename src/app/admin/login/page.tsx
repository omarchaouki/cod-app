import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'تسجيل الدخول',
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper-deep px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <h1 className="text-2xl font-black text-ink">لوحة التحكم</h1>
          <p className="mt-2 text-sm text-ink-muted">دفاتر التربية البدنية</p>
        </div>

        <div className="mt-7 rounded-card border border-line bg-surface p-6 shadow-card">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
