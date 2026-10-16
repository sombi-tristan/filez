'use client'

import { useCallback, useEffect, useState } from 'react'
import { desktopOutline } from 'ionicons/icons'
import { Button, ConfirmDialog, EmptyState, LoadFailed, SectionHeader, Spinner } from '@/design'
import { fmtDate } from '@/lib/formatDate'

/**
 * Linked computers: the StationMGR Desktop computers linked to the stations this person owns
 * (app/api/desktop/devices), and the way to revoke one, for a computer that is lost, sold or no
 * longer the station's. Kept on a computer's browser too (lib/platform.js COMPUTER_PATHS).
 *
 * Online by nature: who is linked lives on the web, not in the phone's local copy.
 */
function when(iso) {
  return iso ? fmtDate(iso.slice(0, 10)) : 'never'
}

export default function LinkedComputersPage() {
  const [computers, setComputers] = useState(null)
  const [failed, setFailed] = useState(false)
  const [revoking, setRevoking] = useState(null)

  const load = useCallback(() => {
    setFailed(false)
    fetch('/api/desktop/devices')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body) => setComputers(body.computers || []))
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => { load() }, [load])

  const revoke = async () => {
    const res = await fetch('/api/desktop/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: revoking.id }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { error: body.error || 'Could not revoke it' }
    setComputers((list) => list.map((c) => (c.id === revoking.id ? { ...c, revoked_at: body.revoked_at } : c)))
    return null
  }

  if (failed) return <div className="max-w-2xl mx-auto px-4 py-8"><LoadFailed onRetry={load} /></div>
  if (!computers) return <div className="flex justify-center py-20"><Spinner /></div>

  const active = computers.filter((c) => !c.revoked_at)
  const revoked = computers.filter((c) => c.revoked_at)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <p className="text-[15px] text-content-muted mb-6">
        Computers running StationMGR for Windows that are linked to your stations. Revoke one that is
        lost, sold or no longer yours: it stops pushing, pulling and renewing its subscription. What is
        already on it stays there.
      </p>

      {computers.length === 0 ? (
        <EmptyState icon={desktopOutline} title="No linked computers">
          Link a computer from inside StationMGR for Windows with your web email and password.
        </EmptyState>
      ) : (
        <>
          <SectionHeader>Linked</SectionHeader>
          {active.length === 0 ? (
            <p className="text-[15px] text-content-muted mb-6">None.</p>
          ) : (
            <ul className="flex flex-col gap-2 mb-8">
              {active.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border-2 border-line rounded-house">
                  <div className="min-w-0">
                    <p className="font-semibold text-content truncate">{c.name || 'Computer'}</p>
                    <p className="text-sm text-content-muted">
                      {c.station_name} · linked {when(c.created_at)} · last seen {when(c.last_seen_at)}
                    </p>
                  </div>
                  <Button variant="danger" expand="inline" size="small" onClick={() => setRevoking(c)}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}

          {revoked.length > 0 && (
            <>
              <SectionHeader>Revoked</SectionHeader>
              <ul className="flex flex-col gap-2">
                {revoked.map((c) => (
                  <li key={c.id} className="p-3 border-2 border-line rounded-house opacity-70">
                    <p className="font-semibold text-content truncate">{c.name || 'Computer'}</p>
                    <p className="text-sm text-content-muted">{c.station_name} · revoked {when(c.revoked_at)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title={`Revoke ${revoking?.name || 'this computer'}?`}
        confirmLabel="Revoke"
      >
        It will no longer push, pull or renew {revoking?.station_name ? `${revoking.station_name}’s` : 'the'} subscription.
        To use it again, link it afresh from the app.
      </ConfirmDialog>
    </div>
  )
}
