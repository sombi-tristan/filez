'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getLink } from '@/lib/local/link'
import { replaceWeb } from '@/lib/local/webSync'
import { useLicence } from '@/components/desktop/LicenceGate'
import { BTN_DANGER, BTN_FRAMED, CARD, SectionHeader } from '@/components/ui'

/**
 * Desktop build, the station's Settings page: "Make the web match this computer". The station
 * here is the source of truth for corrections: its web copy is cleared and replaced by this
 * computer's records (lib/local/webSync.js replaceWeb). Only for a linked station with a
 * subscription running; a restore does the same by itself.
 */
export default function WebCopy({ stationId, stationName }) {
  const paid = Boolean(useLicence()?.paid)
  const [link, setLink] = useState(() => getLink(stationId))
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')

  useEffect(() => {
    const update = () => setLink(getLink(stationId))
    window.addEventListener('stationmgr:link', update)
    return () => window.removeEventListener('stationmgr:link', update)
  }, [stationId])

  if (!link || link.revoked || !paid) return null

  const replace = async () => {
    setConfirming(false); setBusy(true); setResult('')
    const r = await replaceWeb(stationId).catch((e) => ({ ok: false, error: e.message }))
    setBusy(false)
    if (!r.ok) setResult(`${r.error || 'Could not replace the web copy'}. Nothing here changed; it tries again at the next sync.`)
    else if (r.refused?.length) setResult(`Sent ${r.pushed}. ${r.refused.length} not accepted, still waiting here: ${r.refused.slice(0, 5).map((x) => x.error).join('; ')}`)
    else setResult(`The web copy now matches this computer: ${r.pushed} record${r.pushed === 1 ? '' : 's'} sent.`)
  }

  return (
    <section className="mb-6">
      <SectionHeader>Web copy</SectionHeader>
      <div className={`p-3 space-y-3 ${CARD}`}>
        <p className="text-sm text-content">
          {link.replacePending
            ? 'A correction here is waiting to replace the web copy of this station. It happens at the next sync, or now.'
            : 'This computer is the source of truth for corrections. Make the web copy match it after fixing records here.'}
        </p>
        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm text-content">
              The web copy of <strong>{stationName || 'this station'}</strong> will be cleared and replaced by this computer&apos;s
              records: setup, opening balances and entries. Anything entered on the web since the last pull (on a phone, say) is removed.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className={`px-4 py-2 text-sm font-medium ${BTN_FRAMED}`}>Cancel</button>
              <button onClick={replace} className={`px-4 py-2 text-sm font-medium ${BTN_DANGER}`}>Replace the web copy</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} disabled={busy} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium disabled:opacity-50 ${BTN_FRAMED}`}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Make the web match this computer
          </button>
        )}
        {result && <p className="text-sm text-content-muted" role="status">{result}</p>}
      </div>
    </section>
  )
}
