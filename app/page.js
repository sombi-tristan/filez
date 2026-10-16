'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Fuel, ClipboardList, BarChart3, Users } from 'lucide-react'
import Footer from '@/components/Footer'
import { BTN_FRAMED, BTN_PRIMARY } from '@/components/ui'

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.user) setLoggedIn(true) })
      .catch(() => {})
  }, [])

  return (
    // A column at least the screen's height, so the footer sits at the bottom of a short page.
    <div className="min-h-screen flex flex-col">
    {/* The landing page gets no AppShell (see components/AppShell.js: `/` returns bare
        children), so it carries its own bar. Same chrome as the app header, h-14 and the blue
        rule, so arriving from the site into the dashboard is not a change of furniture.

        It repeats the hero's calls to action on purpose: once the page is scrolled past the
        fold there is otherwise no way in without scrolling back up. */}
    <header className="sticky top-0 z-30 border-b border-primary-500/40 dark:border-primary-400/40 bg-surface">
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 min-w-0" aria-label="StationMGR home">
          <Image src="/icon-192.png" alt="" aria-hidden width={24} height={24} className="w-6 h-6 shrink-0" />
          <span className="text-sm font-bold text-content truncate">StationMGR</span>
        </Link>

        <nav className="flex items-center gap-2 shrink-0">
          {loggedIn ? (
            <Link href="/dashboard" className={`px-3 py-1.5 text-sm font-semibold ${BTN_PRIMARY}`}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className={`px-3 py-1.5 text-sm font-semibold ${BTN_FRAMED}`}>
                Log in
              </Link>
              {/* Hidden on the narrowest screens: two buttons plus the wordmark do not fit a
                  small phone, and Log in is the one a returning user needs. The hero below
                  still offers Create Account. */}
              <Link href="/auth/register" className={`hidden sm:inline-flex px-3 py-1.5 text-sm font-semibold ${BTN_PRIMARY}`}>
                Create Account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>

    <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <div className="flex justify-center mb-5">
          <img src="/icon-192.png" alt="StationMGR" className="w-14 h-14" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-content mb-3">
          StationMGR
        </h1>
        <p className="text-base text-content-muted max-w-md mx-auto">
          Daily sales, lodgements, stock receipts, and reports — all in one place.
        </p>
      </div>

      <div className="flex justify-center gap-3 mb-16">
        {loggedIn ? (
          <Link href="/dashboard" className={`px-6 py-2.5 font-semibold ${BTN_PRIMARY}`}>
            Dashboard
          </Link>
        ) : (
          <>
            <Link href="/auth/login" className={`px-6 py-2.5 font-semibold ${BTN_FRAMED}`}>
              Log in
            </Link>
            <Link href="/auth/register" className={`px-6 py-2.5 font-semibold ${BTN_PRIMARY}`}>
              Create Account
            </Link>
          </>
        )}
      </div>

      <div className="border-t border-line pt-12">
        <div className="grid sm:grid-cols-2 gap-8">
          <div className="flex gap-3">
            <Fuel className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-content mb-1">Daily Sales Entry</h3>
              <p className="text-sm text-content-muted">
                Record pump readings, nozzle sales, and tank dips per shift.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <ClipboardList className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-content mb-1">Lodgements & Receipts</h3>
              <p className="text-sm text-content-muted">
                Track bank lodgements, product receipts, and customer payments.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <BarChart3 className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-content mb-1">Reports</h3>
              <p className="text-sm text-content-muted">
                Generate daily sales reports, audit reports, and variance summaries.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Users className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-content mb-1">Multi-Station Access</h3>
              <p className="text-sm text-content-muted">
                Invite staff, assign roles, and manage multiple stations from one account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </div>
  )
}
