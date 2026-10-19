import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  fallbacks: {
    document: '/~offline',
  },
  // MUST be nested under workboxOptions. A top-level `runtimeCaching` key is silently
  // ignored by @ducanh2912/next-pwa v10, and the worker falls back to its default cache,
  // which caches pages, RSC payloads AND api responses. That is what this config was
  // written to prevent, and for a long time it was not preventing it: the emitted worker
  // carried cacheName:"pages" and cacheName:"apis". Verify after any upgrade by grepping
  // public/sw.js for cacheName:"pages" — if it is there, these rules are not applying.
  workboxOptions: {
    runtimeCaching: [
      {
        // Never cache API routes — always hit the server
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkOnly',
      },
      {
        // Next.js page data and JS chunks — network first, fast fallback
        urlPattern: /\/_next\/.*/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'next-assets',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          networkTimeoutSeconds: 5,
        },
      },
      {
        // Static assets only (images, fonts, etc.) — exclude page navigations
        urlPattern: ({ request }) => request.destination !== 'document' && request.destination !== '',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'offlineCache',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          },
          networkTimeoutSeconds: 5,
        },
      },
    ],
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.supabase.co; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';",
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ]
  },
}

/**
 * The Android app (scripts/build-android.mjs): the screens written out as files (out/) for the
 * app to carry, with no server. So no service worker and no headers, and the API is the site's.
 */
const androidConfig = {
  output: 'export',
  images: { ...nextConfig.images, unoptimized: true },
  env: { NEXT_PUBLIC_API_ORIGIN: 'https://www.stationmgr.site' },
}

export default process.env.STATIONMGR_TARGET === 'android' ? androidConfig : withPWA(nextConfig)
