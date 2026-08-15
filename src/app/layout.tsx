import type { Metadata, Viewport } from 'next'
import { Tajawal } from 'next/font/google'
import './globals.css'

/**
 * Tajawal: an Arabic face designed for screens, with real weights rather than
 * synthesised bold, and Latin digits that sit correctly on the Arabic baseline
 * — which matters on a page full of prices and phone numbers.
 */
const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700', '800', '900'],
  display: 'swap',
  variable: '--font-tajawal',
  preload: true,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'دفتر النصوص + الدفتر اليومي — التربية البدنية والرياضية 2026/2027',
    template: '%s | دفاتر التربية البدنية',
  },
  description:
    'دفتران رسميان لأستاذ التربية البدنية والرياضية بالسلكين الإعدادي والتأهيلي. تنظيم القسم، تتبع الحصص، وشبكات التنقيط الرسمية في وثيقة واحدة. الدفع عند الاستلام.',
  applicationName: 'دفاتر التربية البدنية',
  authors: [{ name: 'دفاتر التربية البدنية' }],
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never cap zoom — capping it locks out anyone who needs to enlarge text.
  maximumScale: 5,
  themeColor: '#fbf8f3',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
