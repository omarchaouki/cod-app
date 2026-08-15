import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from './server'

/**
 * Server-side authorisation for every admin page.
 *
 * The middleware already blocks unauthenticated requests, but middleware alone
 * is not an authorisation boundary — this re-checks the session *and* the
 * admin allow-list on the server before any data is read.
 *
 * Wrapped in React's `cache()` so that the auth round trip happens once per
 * request no matter how many streamed sections call it. Each `<Suspense>`
 * block on the dashboard needs a client, and without this they would each pay
 * for their own `getUser()` + `is_admin()` calls.
 */
export const requireAdmin = cache(async () => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  const { data: isAdmin, error } = await supabase.rpc('is_admin')

  if (error || !isAdmin) {
    redirect('/admin/login?error=forbidden')
  }

  return { supabase, user }
})
