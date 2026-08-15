import Image from 'next/image'
import { BadgeCheck, PackageCheck, PhoneCall, Wallet } from 'lucide-react'
import { OrderForm } from './order-form'
import type { ProductView } from './product-view'

const ORDER_ASSURANCES = [
  { icon: Wallet, text: 'لا تدفع شيئاً الآن — الدفع عند الاستلام' },
  { icon: PhoneCall, text: 'مكالمة تأكيد قبل إرسال الطلب' },
  { icon: PackageCheck, text: 'التوصيل لجميع المدن المغربية' },
]

export function OfferSection({ product }: { product: ProductView }) {
  return (
    <section id="order" className="scroll-mt-20 bg-paper-deep py-14 md:py-20">
      <div className="content-width">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-amber">اطلب الآن</p>
          <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">
            املأ المعلومات وسنتصل بك للتأكيد
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ink-soft">
            ثلاث خانات فقط. لا حساب، ولا دفع إلكتروني.
          </p>
        </div>

        <div className="mx-auto mt-9 grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          {/* Offer summary */}
          <aside className="rounded-card border border-line bg-surface p-6 shadow-card">
            <figure className="overflow-hidden rounded-lg border border-line">
              <Image
                src="/images/pack-cahiers.webp"
                alt="باك دفتر النصوص والدفتر اليومي للتربية البدنية"
                width={1600}
                height={873}
                loading="lazy"
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="h-auto w-full"
              />
            </figure>

            <h3 className="mt-5 text-lg font-black leading-snug text-ink">{product.name}</h3>

            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <span className="num text-3xl font-black text-cta">{product.priceLabel}</span>
              {product.compareAtLabel ? (
                <span className="num text-lg text-ink-muted line-through">
                  {product.compareAtLabel}
                </span>
              ) : null}
              {product.discountPercent ? (
                <span className="rounded-md bg-amber-soft px-2 py-1 text-sm font-bold text-amber">
                  −{product.discountPercent}%
                </span>
              ) : null}
            </div>

            <ul className="mt-6 space-y-3 border-t border-line pt-5">
              {ORDER_ASSURANCES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
                  <span className="text-[0.95rem] leading-relaxed text-ink-soft">{text}</span>
                </li>
              ))}
            </ul>

            <p className="mt-5 flex items-center gap-2 rounded-lg bg-brand-soft px-4 py-3 text-sm font-bold text-brand-ink">
              <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
              يشمل الباك الدفترين معاً
            </p>
          </aside>

          {/* The form itself — on the same page, no checkout step. */}
          <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-7">
            <h3 id="order-form-title" className="sr-only">
              نموذج الطلب
            </h3>
            <OrderForm product={product} />
          </div>
        </div>
      </div>
    </section>
  )
}
