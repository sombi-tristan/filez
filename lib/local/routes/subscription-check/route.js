import { NextResponse } from '@/lib/local/nextServer'

// Desktop build: no subscriptions — every service is on.
export async function GET() {
  return NextResponse.json({ subscribed: true, grace: false })
}
