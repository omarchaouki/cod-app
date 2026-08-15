import 'server-only'

import { createAdminClient } from './supabase/admin'
import type { Product, Settings } from './db/types'

/**
 * The landing page's product. Prices and costs live only here — the frontend
 * never hardcodes a number and the browser never sends one back.
 */
export async function getActiveProduct(slug?: string): Promise<Product | null> {
  try {
    const supabase = createAdminClient()

    const query = supabase.from('products').select('*').eq('is_active', true).limit(1)
    const { data, error } = slug
      ? await query.eq('slug', slug).maybeSingle()
      : await query.order('created_at', { ascending: true }).maybeSingle()

    if (error) {
      console.error('[products] failed to load the active product', error.message)
      return null
    }
    return data as Product | null
  } catch (error) {
    // Reached when Supabase is not configured yet. The page renders its
    // unavailable state rather than failing the whole build.
    console.error('[products] Supabase is unavailable', (error as Error).message)
    return null
  }
}

export async function getSettings(): Promise<Settings | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('settings').select('*').eq('id', true).maybeSingle()

    if (error) {
      console.error('[settings] failed to load settings', error.message)
      return null
    }
    return data as Settings | null
  } catch (error) {
    console.error('[settings] Supabase is unavailable', (error as Error).message)
    return null
  }
}
