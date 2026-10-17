import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/entryHelpers'
import { authenticateDevice, signLicence, serviceDates } from '@/lib/desktop'
import { PUSH_ORDER } from '@/lib/desktopTables'
import { wipeStation } from '@/lib/desktopWipe'

/**
 * A linked desktop computer replaces its web station's copy: POST with
 * `Authorization: Device <token>` clears the station's synced records here (lib/desktopWipe.js),
 * and the computer then pushes all of its own. The station on the computer is the source of
 * truth when it corrects something; staff entries from the web reach it by pull otherwise.
 *
 * Only the computer linked to that station, by its owner, can ask; the station row stays. Like
 * a push it needs a subscription running (403 otherwise, with a fresh licence).
 * Answers { ok, licence }.
 */
export async function POST(request) {
  try {
    const linked = await authenticateDevice(request)
    if (!linked) return NextResponse.json({ error: 'This computer is not linked' }, { status: 401 })

    const orgId = linked.station.id
    const licence = await signLicence({ orgId, deviceId: linked.device.id, stationName: linked.station.name })
    const running = await serviceDates(orgId)
    if (!Object.keys(running).length) {
      return NextResponse.json({ error: 'Replacing the web copy needs the station to have a subscription running', licence }, { status: 403 })
    }

    const res = await wipeStation(getServiceClient(), orgId, PUSH_ORDER)
    if (!res.ok) return NextResponse.json({ error: res.error, licence }, { status: 500 })
    return NextResponse.json({ ok: true, licence })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
