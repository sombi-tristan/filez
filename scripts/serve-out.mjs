// Serves out/ exactly as the desktop app resolves it, for testing the export in a browser:
//   npm run build && node scripts/serve-out.mjs   → http://localhost:4173
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const { resolveExportPath, mimeFor } = createRequire(import.meta.url)('../electron/resolve.js')

const root = path.resolve('out')
const port = Number(process.env.PORT || 4173)
http.createServer((req, res) => {
  const file = resolveExportPath(root, req.url)
  res.writeHead(file.endsWith('404.html') ? 404 : 200, { 'content-type': mimeFor(file) })
  fs.createReadStream(file).pipe(res)
}).listen(port, () => console.log(`out/ on http://localhost:${port}`))
