'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { lockClosedOutline, refreshOutline, openOutline, linkOutline } from 'ionicons/icons'
import { Button, Dialog, EmptyState, Spinner } from '@/design'
import { checkLicence } from '@/lib/local/licence'
import { refreshLicence } from '@/lib/local/webSync'
import { getLink } from '@/lib/local/link'
import { openWeb } from '@/lib/local/web'
import { fmtDate } from '@/lib/formatDate'
import LinkForm from '@/components/desktop/LinkForm'
import { FREE_REPORT_DAYS } from '@/lib/reportRange'

/**
 * Desktop build: what this computer may open, from the station's licence (lib/local/licence.js).
 *
 * Free, with no link and no subscription: daily sales, lodgements and product receipt, and
 * reports of up to 5 days. Each other entry type needs its own service, as on the web
 * (screens/routes.js `service`). Backup, reports longer than 5 days, exporting a report, and
 * push and pull need any service running (`paid`), which needs the computer linked to its web
 * station.
 *
 * Re-checked whenever a licence or a link arrives, every minute, and renewed from the web when
 * the computer is online. Screens wait for the first check, so `paidNow()` is answered before
 * any of them opens.
 */
const LicenceContext = createContext(null)

export function useLicence() {
  return useContext(LicenceContext)
}

/** The service names a person reads. */
export const SERVICE_NAMES = {
  'fuel-operations': 'Fuel operations',
  'lube-management': 'Lube management',
  'customer-payments': 'Customer payments',
}

function useLicenceState() {
  const [state, setState] = useState(null)
  const recheck = useCallback(() => { checkLicence().then(setState) }, [])

  useEffect(() => {
    recheck()
    const renew = () => { if (getLink()) refreshLicence().finally(recheck) }
    renew()
    const events = ['stationmgr:licence', 'stationmgr:link']
    events.forEach((e) => window.addEventListener(e, recheck))
    window.addEventListener('online', renew)
    const timer = setInterval(recheck, 60 * 1000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, recheck))
      window.removeEventListener('online', renew)
      clearInterval(timer)
    }
  }, [recheck])

  return [state, recheck]
}

export default function LicenceGate({ children }) {
  const [state, recheck] = useLicenceState()
  if (!state) return <div className="h-full flex items-center justify-center"><Spinner /></div>
  const paid = state.status === 'ok' && state.anyActive
  return <LicenceContext.Provider value={{ ...state, paid, recheck }}>{children}</LicenceContext.Provider>
}

/**
 * The way to unlock something: link this computer first if it is not linked; once linked,
 * renew on the web and check again.
 */
export function UnlockActions({ compact = false }) {
  const licence = useLicence()
  const [linking, setLinking] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const link = getLink()

  // Not linked yet, or linked once and since revoked on the web (lib/local/webSync.js).
  if (!link || link.revoked) {
    return (
      <>
        <div className={compact ? '' : 'w-full max-w-xs mx-auto'}>
          <Button icon={linkOutline} expand={compact ? 'inline' : 'block'} onClick={() => setLinking(true)}>{link ? 'Link again' : 'Link this computer'}</Button>
        </div>
        <Dialog open={linking} onClose={() => setLinking(false)} title="Link this computer" placement="bottom">
          <p className="text-[15px] text-content-muted mb-4">The station’s owner signs in with their StationMGR web account, once, online. The station’s subscription then works on this computer, offline.</p>
          <LinkForm canBackUp onLinked={() => { setLinking(false); licence?.recheck?.() }} />
        </Dialog>
      </>
    )
  }

  const check = async () => {
    setChecking(true); setError('')
    const res = await refreshLicence()
    setChecking(false)
    if (!res.ok) setError(res.error)
    licence?.recheck?.()
  }
  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'flex flex-col items-stretch gap-2 w-full max-w-xs mx-auto'}>
      <Button icon={refreshOutline} expand={compact ? 'inline' : 'block'} onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check again'}</Button>
      <Button variant="secondary" icon={openOutline} expand={compact ? 'inline' : 'block'} onClick={() => openWeb(`/dashboard/subscribe?org_id=${link.stationId}`)}>Renew on the web</Button>
      {error && <p className="text-[15px] font-semibold text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}

/** A short note where a paid feature would be: what it needs, and the way to unlock it. */
export function PaidNote({ what, verb = 'needs' }) {
  const licence = useLicence()
  const clock = licence?.status === 'clock'
  return (
    <div className="flex flex-col gap-3 p-3 border-2 border-line rounded-house bg-subtle">
      <p className="text-[15px] text-content">
        {clock
          ? 'This computer’s clock is behind the last time StationMGR ran. Set the date and time right, then check again.'
          : getLink()
            ? `${what} ${verb} the station to have a subscription running.`
            : `${what} ${verb} this computer linked to your station on the web, with a subscription.`}
      </p>
      <UnlockActions compact />
    </div>
  )
}

/**
 * Across the top of a report without a subscription: reports cover any FREE_REPORT_DAYS days at
 * a time, and the way to unlock longer ones. Full width, above the report's dates.
 */
export function FreeReportBanner() {
  const licence = useLicence()
  if (!licence || licence.paid) return null
  const clock = licence.status === 'clock'
  return (
    <div className="w-full border-b-2 border-primary-500/40 bg-primary-50 dark:bg-primary-950/30 px-4 py-3">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-content min-w-0 flex-1">
          {clock
            ? 'This computer’s clock is behind the last time StationMGR ran. Set the date and time right, then check again.'
            : <>Free plan: a report covers any <strong>{FREE_REPORT_DAYS} days</strong> at a time. Move the dates to the days you need. {getLink() ? 'A subscription opens longer ranges.' : 'Link this computer to your station, with a subscription, for longer ranges.'}</>}
        </p>
        <UnlockActions compact />
      </div>
    </div>
  )
}

/** A screen whose service has run out: what it needs, and the way to unlock it. */
export function ServiceLocked({ service }) {
  const licence = useLicence()
  const until = licence?.services?.[service]
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <EmptyState icon={lockClosedOutline} title={`${SERVICE_NAMES[service] || 'This service'} is not active`}>
        {!getLink()
          ? 'This screen needs a subscription. Link this computer to your station on the web to use it.'
          : until
            ? `Its subscription ended on ${fmtDate(until.slice(0, 10))}. Renew it on the web to open this screen again.`
            : 'This station has no subscription for it. Add it on the web to open this screen.'}
      </EmptyState>
      <UnlockActions />
    </div>
  )
}
