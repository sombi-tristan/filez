// The house type, self-hosted so it works offline and under the CSP's font-src 'self'.
// Outfit for headings, Source Sans 3 for the rest (design/README.md).
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/800.css'
import '@fontsource/source-sans-3/400.css'
import '@fontsource/source-sans-3/600.css'
import '@fontsource/source-sans-3/700.css'
// Ionic's core only. Its structure.css pins <body> (position: fixed; overflow: hidden) for an
// app that scrolls inside IonContent; every screen here scrolls the document, so it is left out.
import '@ionic/react/css/core.css'
import './globals.css'
import '@/design/house.css'
import AppShell from '@/components/AppShell'
import HouseSetup from '@/components/HouseSetup'
import PWAUpdateToast from '@/components/PWAUpdateToast'

export const metadata = {
  title: 'StationMGR — Station Operations Management',
  description: 'Manage your station entries, reports, and daily operations',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'StationMGR',
  },
}

export const viewport = {
  themeColor: '#0093dd',
}

/**
 * Runs before first paint, so a dark device never opens on a flash of light. The same rule as
 * the design system's applyTheme() (design/components/ThemeControl.jsx): a saved Light or Dark
 * wins, and System (or nothing saved) follows the device. ThemeControl keeps it in step after.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((t!=='light')&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){}})();`

export default function RootLayout({ children }) {
  return (
    // data-accent: one accent per app, and this one is blue.
    // suppressHydrationWarning: the script above changes <html> before React hydrates, and
    // the server cannot know the user's stored choice.
    <html lang="en" data-accent="blue" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        <HouseSetup />
        <AppShell>
          {children}
        </AppShell>
        <PWAUpdateToast />
      </body>
    </html>
  )
}
