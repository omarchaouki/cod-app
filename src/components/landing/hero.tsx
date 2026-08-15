import Image from 'next/image'
import { Check } from 'lucide-react'
import type { ProductView } from './product-view'

const HERO_POINTS = [
  'دفتر النصوص + الدفتر اليومي في باك واحد',
  '12 قسماً · 6 دورات · 12 حصة لكل دورة',
  'شبكات التنقيط الرسمية للإعدادي والتأهيلي',
]

export function Hero({ product }: { product: ProductView }) {
  return (
    <section id="top" className="border-b border-line bg-paper">
      <div className="content-width grid items-center gap-10 py-10 md:grid-cols-2 md:gap-14 md:py-16">
        {/* Copy first in the DOM so it is what a screen reader meets first. */}
        <div className="order-2 md:order-1">
          <p className="inline-flex items-center gap-2 rounded-md bg-amber-soft px-3 py-1.5 text-sm font-bold text-amber">
            الموسم الدراسي 2026 — 2027
          </p>

          <h1 className="mt-4 text-[2rem] font-black leading-[1.25] text-ink sm:text-4xl lg:text-[2.75rem]">
            قسم مضبوط، وثائق جاهزة،
            <br />
            <span className="text-brand">وأستاذ مرتاح البال</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            دفتر النصوص والدفتر اليومي لأستاذ التربية البدنية والرياضية، بالسلكين الإعدادي
            والتأهيلي. كل ما تحتاجه لتنظيم أقسامك وتتبع حصصك وتنقيط تلاميذك، مطبوعاً ومرتباً
            وجاهزاً للاستعمال من أول يوم.
          </p>

          <ul className="mt-6 space-y-3">
            {HERO_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span
                  className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft"
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} />
                </span>
                <span className="text-base font-medium text-ink">{point}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#order"
              className="inline-flex h-14 items-center justify-center rounded-lg bg-cta px-8 text-lg font-bold text-white shadow-lift transition-colors hover:bg-cta-hover"
            >
              اطلب الباك الآن
            </a>

            <p className="flex items-baseline justify-center gap-2 sm:justify-start">
              <span className="num text-2xl font-black text-ink">{product.priceLabel}</span>
              {product.compareAtLabel ? (
                <span className="num text-base text-ink-muted line-through">
                  {product.compareAtLabel}
                </span>
              ) : null}
            </p>
          </div>

          <p className="mt-3 text-sm text-ink-muted">
            {product.isFreeShipping ? 'التوصيل مجاني · ' : ''}تدفع عند استلام الطلب
          </p>
        </div>

        <div className="order-1 md:order-2">
          <figure className="relative overflow-hidden rounded-card border border-line bg-surface shadow-lift">
            <Image
              src="/images/pack-cahiers.webp"
              alt="دفتر النصوص والدفتر اليومي للتربية البدنية والرياضية، غلاف مقوى للموسم الدراسي 2026-2027"
              width={1600}
              height={873}
              /* The hero image is the Largest Contentful Paint element, so it
                 is fetched eagerly at high priority instead of lazily. */
              priority
              fetchPriority="high"
              sizes="(max-width: 768px) 100vw, 50vw"
              className="h-auto w-full"
            />
          </figure>

          {product.discountPercent ? (
            <p className="mt-3 text-center text-sm font-bold text-amber md:text-start">
              عرض الدخول المدرسي — خصم {product.discountPercent}%
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
