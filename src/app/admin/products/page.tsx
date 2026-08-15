import type { Metadata } from 'next'
import { AdminShell } from '@/components/admin/shell'
import { EmptyState } from '@/components/admin/stat-card'
import { ProductForm } from './product-form'
import { StoreSettingsForm } from './store-settings-form'
import { requireAdmin } from '@/lib/supabase/guard'
import type { Product, Settings } from '@/lib/db/types'

export const metadata: Metadata = { title: 'المنتج والإعدادات' }
export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const { supabase } = await requireAdmin()

  const [productsResult, settingsResult] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: true }),
    supabase.from('settings').select('*').eq('id', true).maybeSingle(),
  ])

  const products = (productsResult.data as Product[] | null) ?? []
  const settings = settingsResult.data as Settings | null
  const currency = settings?.currency ?? 'MAD'

  return (
    <AdminShell
      active="/admin/products"
      title="المنتج والإعدادات"
      description="قاعدة البيانات هي المرجع الوحيد للأسعار. أي تعديل هنا ينعكس فوراً على صفحة البيع."
    >
      <div className="space-y-5">
        {products.length === 0 ? (
          <EmptyState message="لا يوجد أي منتج. شغّل ملف supabase/migrations/0002_seed.sql لإنشاء المنتج الأول." />
        ) : (
          products.map((product) => (
            <ProductForm key={product.id} product={product} currency={currency} />
          ))
        )}

        {settings ? <StoreSettingsForm settings={settings} currency={currency} /> : null}
      </div>
    </AdminShell>
  )
}
