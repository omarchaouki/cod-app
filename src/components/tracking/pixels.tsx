import Script from 'next/script'
import { metaPixelScript } from '@/lib/analytics/meta'
import { tiktokPixelScript } from '@/lib/analytics/tiktok'

/**
 * Third-party pixels.
 *
 * Every one of them is opt-in through an environment variable: with no id
 * configured, no script tag is rendered and the page ships zero third-party
 * JavaScript. They all load `afterInteractive` so they never compete with the
 * hero image or the order form for the main thread.
 *
 * Rendered only inside the public site layout — the admin never loads them.
 */
export function Pixels() {
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const tiktokPixelId = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  return (
    <>
      {metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {metaPixelScript(metaPixelId)}
        </Script>
      ) : null}

      {tiktokPixelId ? (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {tiktokPixelScript(tiktokPixelId)}
        </Script>
      ) : null}

      {gaId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
          </Script>
        </>
      ) : null}
    </>
  )
}
