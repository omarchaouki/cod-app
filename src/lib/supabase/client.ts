'use client'

import { createBrowserClient } from '@supabase/ssr'

/** Browser client. Anon key only — it is safe to ship and is bound by RLS. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
