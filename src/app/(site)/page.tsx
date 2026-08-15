import type { Metadata } from 'next'
import { Hero } from '@/components/landing/hero'
import { OfferSection } from '@/components/landing/offer-section'
import {
  BenefitsSection,
  FAQ_ITEMS,
  FaqSection,
  FinalCta,
  GallerySection,
  InsideSection,
  ProblemSection,
  SiteFooter,
  SpecsSection,
} from '@/components/landing/sections'
import { AnnouncementBar, SiteHeader } from '@/components/landing/site-header'
import { StickyCta } from '@/components/landing/sticky-cta'
import { toProductView } from '@/components/landing/product-view'
import { PageTracker } from '@/components/tracking/page-tracker'
import { getActiveProduct, getSettings } from '@/lib/products'
import { centimesToUnits, toCentimes } from '@/lib/money'

/**
 * Revalidate hourly. The page is a static shell whose only dynamic input is
 * the product price, so it is served from cache and stays fast under ad
 * traffic while still picking up price changes made in the admin.
 */
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

const TITLE = 'دفتر النصوص + الدفتر اليومي — التربية البدنية والرياضية 2026/2027'
const DESCRIPTION =
  'باك دفتر النصوص والدفتر اليومي لأستاذ التربية البدنية والرياضية بالسلكين الإعدادي والتأهيلي. 12 قسماً، 6 دورات، وشبكات التنقيط الرسمية. الدفع عند الاستلام والتوصيل لجميع المدن المغربية.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  keywords: [
    'دفتر النصوص',
    'الدفتر اليومي',
    'التربية البدنية والرياضية',
    'أستاذ التربية البدنية',
    'السلك الإعدادي',
    'السلك التأهيلي',
    'cahier de textes EPS',
    'cahier journalier EPS',
    'المغرب',
  ],
  openGraph: {
    type: 'website',
    locale: 'ar_MA',
    url: siteUrl,
    siteName: 'دفاتر التربية البدنية',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: '/images/pack-cahiers.webp',
        width: 1600,
        height: 873,
        alt: 'باك دفتر النصوص والدفتر اليومي للتربية البدنية 2026-2027',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/images/pack-cahiers.webp'],
  },
}

export default async function LandingPage() {
  const [product, settings] = await Promise.all([getActiveProduct(), getSettings()])

  if (!product) {
    return <ProductUnavailable />
  }

  const currency = settings?.currency ?? 'MAD'
  const view = toProductView(product, currency)

  const totalUnits = centimesToUnits(toCentimes(product.price) + toCentimes(product.shipping_price))

  // Structured data. Only facts that are true are asserted here — there is no
  // aggregateRating, because there are no collected reviews to describe.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.name,
        description: product.short_description ?? DESCRIPTION,
        image: [`${siteUrl}/images/pack-cahiers.webp`],
        category: 'وثائق تربوية',
        inLanguage: 'ar',
        offers: {
          '@type': 'Offer',
          url: `${siteUrl}/#order`,
          price: totalUnits.toFixed(2),
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          areaServed: { '@type': 'Country', name: 'MA' },
          acceptedPaymentMethod: {
            '@type': 'PaymentMethod',
            name: 'الدفع عند الاستلام',
          },
        },
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageTracker
        contentId={view.slug}
        contentName={view.name}
        value={view.analyticsValue}
        currency={currency}
      />

      <AnnouncementBar isFreeShipping={view.isFreeShipping} />
      <SiteHeader />

      <main>
        <Hero product={view} />
        <ProblemSection />
        <InsideSection />
        <BenefitsSection />
        <GallerySection />
        <SpecsSection />
        <OfferSection product={view} />
        <FaqSection />
        <FinalCta priceLabel={view.priceLabel} />
      </main>

      <SiteFooter
        storeName={settings?.store_name ?? 'دفاتر التربية البدنية'}
        storePhone={settings?.store_phone ?? null}
      />

      <StickyCta priceLabel={view.totalLabel} />

      {/* Clears the sticky bar so the footer is never hidden behind it. */}
      <div className="h-20 md:hidden" aria-hidden />
    </>
  )
}

function ProductUnavailable() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-black text-ink">المنتج غير متوفر حالياً</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          تعذّر تحميل بيانات المنتج. المرجو المحاولة بعد قليل.
        </p>
      </div>
    </main>
  )
}
