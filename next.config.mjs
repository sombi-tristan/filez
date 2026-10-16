import { readFileSync } from 'node:fs'

// The key this build checks licences with lives in package.json "stationmgr.licencePublicKey"
// (it is public: it can only check a licence, never make one). The environment can override it.
const { stationmgr = {} } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/** @type {import('next').NextConfig} */
// Desktop build: a static export (out/) that Electron loads from disk. No server, no service
// worker, nothing fetched from the network — the API runs inside the app (lib/local).
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY: process.env.NEXT_PUBLIC_DESKTOP_LICENCE_PUBLIC_KEY || stationmgr.licencePublicKey || '',
  },
}

export default nextConfig
