import { readStorageFile } from '@/lib/jsondb/engine'

/** Files stored by the JSON datastore (lib/jsondb/engine.js storage), served back by URL. */
export const dynamic = 'force-dynamic'

const TYPES = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function GET(_request, { params }) {
  if (process.env.DATA_SOURCE !== 'json') return new Response('Not found', { status: 404 })
  const [bucket, ...rest] = (await params).path.map(decodeURIComponent)
  let body
  try { body = readStorageFile(bucket, rest.join('/')) } catch { body = null }
  if (!body) return new Response('Not found', { status: 404 })
  const ext = rest[rest.length - 1]?.split('.').pop()?.toLowerCase()
  return new Response(body, { headers: { 'Content-Type': TYPES[ext] || 'application/octet-stream' } })
}
