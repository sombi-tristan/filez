'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { BTN_PRIMARY } from '@/components/ui'
import { ANDROID_DOWNLOAD_URL } from '@/lib/platform'

const STEPS = [
  'Tap the button to download StationMGR.apk.',
  'Open the file when it finishes downloading.',
  'If Android blocks it, tap Settings and turn on “Allow from this source”, then go back.',
  'Tap Install, then Open.',
]

/**
 * The landing page's Android download: the button and how to install it. Hidden on an iPhone or
 * iPad, which cannot install it, and inside the Android app itself (Capacitor). Decided after
 * mount, so it starts hidden rather than flashing on those.
 */
export default function AndroidDownload() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    // iPadOS asks for the desktop site and reports itself as a Mac with a touch screen.
    const apple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    const inApp = !!window.Capacitor?.isNativePlatform?.()
    setShow(!apple && !inApp)
  }, [])

  if (!show) return null

  return (
    <div className="border-t border-line pt-12 mb-16">
      <div className="flex flex-col items-center gap-2 mb-8">
        <a href={ANDROID_DOWNLOAD_URL} className={`inline-flex items-center gap-2 px-8 py-3 text-base font-semibold ${BTN_PRIMARY}`}>
          <Download className="w-5 h-5" /> Download for Android
        </a>
        <span className="text-sm text-content-faint">Android 7 or newer</span>
      </div>

      <ol className="max-w-md mx-auto grid gap-3">
        {STEPS.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 h-6 shrink-0 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            <span className="text-sm text-content-muted pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
