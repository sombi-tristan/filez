import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query, auth, storage, SESSION_COOKIE } from '@/lib/jsondb/engine'

/**
 * The JSON datastore's door for the browser and the Edge middleware (lib/jsondb/remote.js).
 * Answers nothing unless the server was started with DATA_SOURCE=json (`npm run dev:json`).
 */
export const dynamic = 'force-dynamic'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30

export async function POST(request) {
  if (process.env.DATA_SOURCE !== 'json') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { kind, op, action, args, token: sent } = await request.json()
  const cookieStore = await cookies()
  const token = sent || cookieStore.get(SESSION_COOKIE)?.value || null

  let result
  if (kind === 'query') result = query(op)
  else if (kind === 'auth') result = auth(action, args, token)
  else if (kind === 'storage') {
    const body = typeof args?.body === 'string' ? Buffer.from(args.body, 'base64') : args?.body
    result = storage(action, { ...args, body })
    // A download is bytes; the browser gets them back as base64.
    if (action === 'download' && Buffer.isBuffer(result.data)) result = { ...result, data: result.data.toString('base64') }
  } else return NextResponse.json({ error: 'Unknown request' }, { status: 400 })

  const res = NextResponse.json(result)
  if (result.setSession) {
    res.cookies.set(SESSION_COOKIE, result.setSession.access_token, { path: '/', sameSite: 'lax', maxAge: SESSION_MAX_AGE })
  }
  if (result.clearSession) res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
