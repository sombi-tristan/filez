// Maps a request path to a file in the static export (out/), the way a web host would:
//   /                      → index.html
//   /auth/login            → auth/login.html
//   /dashboard/entries     → dashboard/entries.html, or dashboard/entries/index.html
//   /_next/static/...      → that file
// Anything else falls back to 404.html. Shared by the Electron app and scripts/serve-out.mjs.
const path = require('node:path')
const fs = require('node:fs')

function resolveExportPath(root, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  p = path.posix.normalize(p).replace(/^(\.\.(\/|$))+/, '')
  if (p.endsWith('/') && p !== '/') p = p.slice(0, -1)

  const candidates = p === '/' || p === ''
    ? ['index.html']
    : [p.slice(1), `${p.slice(1)}.html`, `${p.slice(1)}/index.html`]

  for (const rel of candidates) {
    const full = path.join(root, rel)
    if (!full.startsWith(root)) continue
    try {
      if (fs.statSync(full).isFile()) return full
    } catch { /* try next */ }
  }
  return path.join(root, '404.html')
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.map': 'application/json',
}

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'
}

module.exports = { resolveExportPath, mimeFor }
