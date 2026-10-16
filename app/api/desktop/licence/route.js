import { NextResponse } from 'next/server'
import { authenticateDevice, signLicence } from '@/lib/desktop'

/**
 * A fresh licence for a linked computer: GET with `Authorization: Device <token>`. The
 * computer asks whenever it is online, so a renewed subscription reaches it without a push or
 * pull. 401 means the computer was revoked or never linked.
 */
export async function GET(request) {
  try {
    const linked = await authenticateDevice(request)
    if (!linked) return NextResponse.json({ error: 'This computer is not linked' }, { status: 401 })
    const licence = await signLicence({ orgId: linked.station.id, deviceId: linked.device.id, stationName: linked.station.name })
    return NextResponse.json({ licence })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
