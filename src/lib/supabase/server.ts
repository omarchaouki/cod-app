import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * `createServerClient` accepts either the modern getAll/setAll pair or the
 * deprecated get/set/remove trio, and TypeScript cannot infer which arm of that
 * union an inline object literal belongs to. Naming the parameter type keeps
 * the file free of implicit `any`.
 */
type CookiesToSet = { name: string; value: string; options: CookieOptions }[]

/**
 * Server client bound to the visitor's session cookies. Runs as the logged-in
 * user, so every query is still filtered by Row Level Security.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}
