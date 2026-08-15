'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(
    searchParams.get('error') === 'forbidden'
      ? 'هذا الحساب غير مخوّل للدخول إلى لوحة التحكم.'
      : null,
  )
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    if (signInError) {
      // Deliberately vague: distinguishing "no such user" from "wrong password"
      // would let anyone enumerate valid accounts.
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
      setLoading(false)
      return
    }

    const next = searchParams.get('next')
    // Only same-origin paths are accepted, so `?next=` cannot be used to bounce
    // a freshly authenticated admin to an external site.
    const target = next && next.startsWith('/admin') ? next : '/admin/dashboard'

    router.replace(target)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          type="email"
          dir="ltr"
          className="text-start"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input
          id="password"
          type="password"
          dir="ltr"
          className="text-start"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-cta-soft px-4 py-3 text-sm font-bold text-cta">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="brand" size="lg" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            جاري الدخول…
          </>
        ) : (
          'دخول'
        )}
      </Button>
    </form>
  )
}
