'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { IonContent, IonPage } from '@ionic/react'
import { lockClosedOutline, refreshOutline, openOutline, logOutOutline } from 'ionicons/icons'
import { Button, EmptyState, Spinner } from '@/design'
import { checkLicence } from '@/lib/local/licence'
import { refreshLicence } from '@/lib/local/webSync'
import { getLink } from '@/lib/local/link'
import { openWeb } from '@/lib/local/web'
import { clearSession } from '@/lib/local/session'
import { fmtDate } from '@/lib/formatDate'
import LinkForm from '@/components/desktop/LinkForm'

/**
 * The station's subscriptions, as this computer sees them (lib/local/licence.js), for every
 * screen. Re-checked whenever a licence arrives, every minute, and renewed from the web when
 * the computer is online.
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

function signOut() {
  clearSession()
  window.location.replace('/auth/login')
}

/** Renew on the web, and check again once that is done. */
export function RenewActions({ onChecked }) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const stationId = getLink()?.stationId
  const check = async () => {
    setChecking(true); setError('')
    const res = await refreshLicence()
    setChecking(false)
    if (!res.ok) setError(res.error)
    onChecked?.()
  }
  return (
    <div className="flex flex-col items-stretch gap-2 w-full max-w-xs mx-auto">
      <Button icon={refreshOutline} onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check again'}</Button>
      <Button variant="secondary" icon={openOutline} onClick={() => openWeb(stationId ? `/dashboard/subscribe?org_id=${stationId}` : '/dashboard')}>Renew on the web</Button>
      {error && <p className="text-[15px] font-semibold text-red-600 dark:text-red-400 text-center">{error}</p>}
      <p className="text-[13px] text-content-faint text-center">Check again needs the internet once. After that this computer works offline again.</p>
    </div>
  )
}

const WHY = {
  missing: 'This computer has no subscription record yet.',
  invalid: 'The subscription record on this computer could not be checked.',
  clock: 'This computer’s clock is behind the last time StationMGR ran. Set the date and time right, then check again.',
}

/**
 * Lets the station's screens open only on a linked computer with at least one running
 * service. Otherwise the whole app shows the way to link or renew; sign-in and the start page
 * are outside it.
 */
export default function LicenceGate({ children }) {
  const [state, recheck] = useLicenceState()

  if (!state) return <div className="h-full flex items-center justify-center"><Spinner /></div>

  if (state.status === 'unlinked') {
    return (
      <IonPage>
        <IonContent>
          <div className="max-w-sm mx-auto px-4 py-12">
            <h1 className="text-2xl font-bold text-content mb-1">Link this computer</h1>
            <p className="text-[15px] text-content-muted mb-6">StationMGR on this computer now works with your station’s subscription on the web. The station’s owner links it once; after that it works offline.</p>
            <LinkForm canBackUp onLinked={recheck} />
            <div className="mt-6"><Button variant="neutral" icon={logOutOutline} onClick={signOut}>Sign out</Button></div>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  if (state.status !== 'ok' || !state.anyActive) {
    const lapsed = Object.entries(state.services || {})
    return (
      <IonPage>
        <IonContent>
          <div className="max-w-md mx-auto px-4 py-12">
            <EmptyState icon={lockClosedOutline} title="StationMGR is locked on this computer">
              {WHY[state.status] || 'The station’s subscription has run out. Renew it on the web, then check again here.'}
            </EmptyState>
            {lapsed.length > 0 && (
              <ul className="mb-6 border-2 border-line rounded-house divide-y-2 divide-line">
                {lapsed.map(([key, until]) => (
                  <li key={key} className="flex justify-between gap-3 px-3 py-2.5 text-[15px]">
                    <span className="font-semibold text-content">{SERVICE_NAMES[key] || key}</span>
                    <span className="text-content-muted">ended {fmtDate(until.slice(0, 10))}</span>
                  </li>
                ))}
              </ul>
            )}
            <RenewActions onChecked={recheck} />
            <div className="mt-6 max-w-xs mx-auto"><Button variant="neutral" icon={logOutOutline} onClick={signOut}>Sign out</Button></div>
          </div>
        </IonContent>
      </IonPage>
    )
  }

  return <LicenceContext.Provider value={{ ...state, recheck }}>{children}</LicenceContext.Provider>
}

/** A screen whose service has run out: what it needs, and the way to renew. */
export function ServiceLocked({ service }) {
  const licence = useLicence()
  const until = licence?.services?.[service]
  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <EmptyState icon={lockClosedOutline} title={`${SERVICE_NAMES[service] || 'This service'} is not active`}>
        {until ? `Its subscription ended on ${fmtDate(until.slice(0, 10))}.` : 'This station has no subscription for it.'} Renew it on the web to open this screen again.
      </EmptyState>
      <RenewActions onChecked={licence?.recheck} />
    </div>
  )
}
