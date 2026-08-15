'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function SignOutButton({ compact }: { compact?: boolean }) {
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className={[
        'flex items-center gap-2 rounded-lg text-sm font-bold text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink',
        compact ? 'h-9 px-3' : 'h-11 w-full px-3',
      ].join(' ')}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      خروج
    </button>
  )
}
