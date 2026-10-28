import withPWAInit from '@ducanh2912/next-pwa'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * DATA_SOURCE=json (`npm run dev:json`): Supabase stood in for by .json files in jsondb/data,
 * for running locally with the test data from scripts/jsondb-seed.mjs. Both Supabase packages
 * are pointed at lib/jsondb: the Node build runs queries in-process, the browser and the Edge
 * middleware post them to app/api/jsondb. Nothing else in the app changes, and no other build
 * is affected.
 *
 * The Android test build (`npm run build:android:json`) is the same, with the API on the PC
 * running dev:json (JSONDB_API_ORIGIN) instead of the site.
 */
const jsonDatastore = process.env.DATA_SOURCE === 'json'

function withJsonDatastore(config, { android = false } = {}) {
  if (!jsonDatastore) return config
  const port = process.env.PORT || 3000
  if (android && !process.env.JSONDB_API_ORIGIN) {
    throw new Error('JSONDB_API_ORIGIN must name the PC running `npm run dev:json`, e.g. http://192.168.1.20:3000')
  }
  return {
    ...config,
    // Its own build folder, so a cached Supabase build in .next is never reused with it. Not for
    // the Android build: with output 'export', a distDir is also where the export lands, and
    // scripts/build-android.mjs reads it from out/.
    ...(android ? {} : { distDir: '.next-json' }),
    env: {
      ...config.env,
      ...(android ? { NEXT_PUBLIC_API_ORIGIN: process.env.JSONDB_API_ORIGIN } : {}),
      JSONDB_ORIGIN: process.env.JSONDB_ORIGIN || `http://localhost:${port}`,
      // lib/supabaseClient.js makes no client without these; the datastore ignores them.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://jsondb.local',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'jsondb',
    },
    webpack(webpackConfig, options) {
      const target = join(here, 'lib', 'jsondb', options.nextRuntime === 'nodejs' ? 'node.js' : 'remote.js')
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@supabase/supabase-js$': target,
        '@supabase/ssr$': target,
      }
      return config.webpack ? config.webpack(webpackConfig, options) : webpackConfig
    },
  }
}

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
        // The Android app's pages are on the phone (https://localhost) and call the API across
        // origins with a bearer token, never cookies (lib/supabaseServer.js), so no credentials.
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://localhost' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
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

export default process.env.STATIONMGR_TARGET === 'android'
  ? withJsonDatastore(androidConfig, { android: true })
  : withJsonDatastore(withPWA(nextConfig))
