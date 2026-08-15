import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /*
   * Emit a self-contained server bundle in `.next/standalone`.
   *
   * This is what makes the app deployable to a small VPS: the output carries
   * only the packages actually imported, so the server does not need the full
   * node_modules tree (hundreds of MB) copied alongside it. Start it with
   * `node .next/standalone/server.js` rather than `next start`.
   */
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 420, 640, 750, 828, 1080, 1200, 1600],
    imageSizes: [256, 384, 512],
    /*
     * How long an optimised variant stays cached. The default is 60 seconds,
     * which means the optimiser re-encodes the hero roughly every minute and
     * some unlucky visitor pays for it. These are product photos that only
     * change when the files change — and the filename changes with them — so
     * cache them for a year.
     */
    minimumCacheTTL: 31536000,
  },
  experimental: {
    // Keep the client bundle lean: only the icons actually used get shipped.
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
