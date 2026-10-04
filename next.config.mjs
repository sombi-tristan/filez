/** @type {import('next').NextConfig} */
// Desktop build: a static export (out/) that Electron loads from disk. No server, no service
// worker, nothing fetched from the network — the API runs inside the app (lib/local).
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
}

export default nextConfig
