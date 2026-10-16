'use client'

import { useEffect, useState } from 'react'

/**
 * Where StationMGR runs, and what each place shows.
 *
 *   - On a computer, StationMGR is the desktop app (the desktop/* branches). The web shows a
 *     computer the download page instead (components/DesktopDownload.js), except for signing in,
 *     buying or renewing a subscription, and the admin area, and for platform admins.
 *   - On a phone or tablet, the web keeps the entries and four reports: Summary, Analytics,
 *     Inventory Log and Account Ledger. The other reports are in the desktop app only
 *     (screens/routes.js `desktopOnly`).
 */

/** A computer: as wide as the split pane that keeps the sidebar open (Tailwind's lg). */
export const COMPUTER = '(min-width: 1024px)'

/** The reports the web keeps, by their stationNav pageKey. */
export const WEB_REPORT_KEYS = ['report-summary', 'report-analytics', 'report-inventory-log', 'report-account-ledger']

/** Dashboard addresses a computer may still open: buying and renewing a subscription. */
export const COMPUTER_PATHS = ['/dashboard/subscribe']

/**
 * The Windows installer: the latest release on GitHub, published by the desktop build
 * (.github/workflows/desktop-build.yml on desktop/offline) under one fixed name.
 */
export const DESKTOP_DOWNLOAD_URL = process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL
  || 'https://github.com/sombi-tristan/filez/releases/latest/download/StationMGR-Setup.exe'

/** Whether the screen is a computer's, following the window as it is resized. */
export function useIsComputer() {
  const [computer, setComputer] = useState(() => typeof window !== 'undefined' && window.matchMedia(COMPUTER).matches)
  useEffect(() => {
    const query = window.matchMedia(COMPUTER)
    const update = () => setComputer(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return computer
}
