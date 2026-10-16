import { NextResponse } from '@/lib/local/nextServer'
import { checkLicence } from '@/lib/local/licence'

// Desktop build: what useSubscription asks, answered from the station's licence
// (lib/local/licence.js) with no internet. `until` is the day the service stops here.
export async function GET(request) {
  const service = new URL(request.url).searchParams.get('service')
  const state = await checkLicence()
  const subscribed = state.status === 'ok' && Boolean(state.active[service])
  return NextResponse.json({ subscribed, grace: false, until: state.services[service] || null })
}
