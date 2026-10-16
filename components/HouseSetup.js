'use client'

import { setupIonicReact } from '@ionic/react'
import { ThickCaret } from '@/design'

/**
 * The house design system's one-time setup (design/README.md, "Taking it into an app").
 *
 * Ionic in one mode, so a screen looks the same on every phone and on a computer. Called at
 * module scope so it runs before any Ionic component renders.
 *
 * ThickCaret is the system's 3px accent caret for every text field; it is mounted once, here.
 */
setupIonicReact({ mode: 'md' })

export default function HouseSetup() {
  return <ThickCaret />
}
