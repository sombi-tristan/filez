import localFont from 'next/font/local'
import './globals.css'
import AppShell from '@/components/AppShell'

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
  weight: '100 900',
})

export const metadata = {
  title: 'StationMGR — Station Operations Management',
  description: 'Manage your station entries, reports, and daily operations',
}

export const viewport = {
  themeColor: '#2563eb',
}

/**
 * Runs before first paint, so a returning dark-mode user never sees a light flash.
 *
 * Deliberately NOT defaulting to the OS preference the way store-portal does: dark mode
 * here is only as complete as the screens converted to semantic tokens, and most of this
 * app still uses literal bg-white / bg-gray-*. Auto-applying dark would give anyone with a
 * dark phone a half-dark app they never asked for. Dark is opt-in until the sweep is done,
 * at which point this can become `t === 'dark' || ((t === 'system' || !t) && sys)`.
 */
const themeScript = `(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: the script above changes <html> before React hydrates, and
    // the server cannot know the user's stored choice.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} font-sans antialiased`}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  )
}
