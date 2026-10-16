'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Download, Monitor, Smartphone, CreditCard } from 'lucide-react'
import Footer from '@/components/Footer'
import { BTN_FRAMED, BTN_PRIMARY } from '@/components/ui'
import { DESKTOP_DOWNLOAD_URL } from '@/lib/platform'

/**
 * What the web shows a computer (lib/platform.js): StationMGR on a computer is the desktop app.
 * It works offline, and links to the station's web account for its subscription and for push
 * and pull, so the way to buy or renew one, and to sign in for it, stays here.
 *
 *   signedIn  whether to offer the subscription page rather than signing in
 */
export default function DesktopDownload({ signedIn = false }) {
  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <div className="min-h-full flex flex-col">
        <div className="flex-1 w-full max-w-2xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <Image src="/icon-192.png" alt="" aria-hidden width={64} height={64} className="w-16 h-16 mx-auto mb-5" />
            <h1 className="text-3xl font-bold text-content mb-3">StationMGR for Windows</h1>
            <p className="text-base text-content-muted max-w-md mx-auto">
              On a computer, StationMGR is an app. It keeps your station’s records on the computer
              and works without the internet.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 mb-12">
            <a href={DESKTOP_DOWNLOAD_URL} className={`inline-flex items-center gap-2 px-8 py-3 text-base font-semibold ${BTN_PRIMARY}`}>
              <Download className="w-5 h-5" /> Download for Windows
            </a>
            <span className="text-sm text-content-faint">Windows 10 or 11, 64-bit</span>
          </div>

          <div className="border-t-2 border-line pt-8 grid gap-6">
            <div className="flex gap-3">
              <Monitor className="w-5 h-5 text-accent mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold text-content mb-1">Install it</h2>
                <p className="text-sm text-content-muted">
                  Open the downloaded file and follow the steps. If Windows says it protected your PC,
                  choose More info, then Run anyway.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <CreditCard className="w-5 h-5 text-accent mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold text-content mb-1">Your subscription</h2>
                <p className="text-sm text-content-muted mb-3">
                  Daily sales, lodgements and short reports are free. A subscription, bought here,
                  opens the rest: link the app to your station from inside it.
                </p>
                <Link href={signedIn ? '/dashboard/subscribe' : '/auth/login?next=/dashboard/subscribe'} className={`inline-flex px-4 py-2 text-sm font-semibold ${BTN_FRAMED}`}>
                  {signedIn ? 'Manage subscription' : 'Sign in to subscribe'}
                </Link>
              </div>
            </div>
            <div className="flex gap-3">
              <Smartphone className="w-5 h-5 text-accent mt-0.5 shrink-0" />
              <div>
                <h2 className="font-semibold text-content mb-1">On your phone</h2>
                <p className="text-sm text-content-muted">
                  Open this site on your phone to make entries and see your reports on the go.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  )
}
