'use client'

import { useEffect, useState } from 'react'
import { IonIcon } from '@ionic/react'
import { desktopOutline, moonOutline, sunnyOutline } from 'ionicons/icons'

/**
 * Light, Dark or System, remembered on the device. It sets `data-theme` on `<html>`, which is
 * what design/house.css turns on; System follows the device and keeps following it.
 *
 * Call `applyTheme()` once before the app draws (in the entry file) so a dark device does not
 * open on a flash of light.
 */
const KEY = 'theme'

const OPTIONS = [
  { key: 'light', label: 'Light', icon: sunnyOutline },
  { key: 'dark', label: 'Dark', icon: moonOutline },
  { key: 'system', label: 'System', icon: desktopOutline },
]

export function savedTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    return OPTIONS.some((o) => o.key === saved) ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(choice = savedTheme()) {
  const deviceDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const dark = choice === 'dark' || (choice === 'system' && deviceDark)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

/** `cycle` draws one icon button that steps Light, Dark, System, for a top bar. */
export default function ThemeControl({ cycle = false, className = '' }) {
  const [choice, setChoice] = useState('system')

  useEffect(() => {
    setChoice(savedTheme())
  }, [])

  // System keeps following the device while it is the choice.
  useEffect(() => {
    if (choice !== 'system' || !window.matchMedia) return undefined
    const device = window.matchMedia('(prefers-color-scheme: dark)')
    const follow = () => applyTheme('system')
    device.addEventListener('change', follow)
    return () => device.removeEventListener('change', follow)
  }, [choice])

  const pick = (key) => {
    setChoice(key)
    try {
      localStorage.setItem(KEY, key)
    } catch {}
    applyTheme(key)
  }

  if (cycle) {
    const at = Math.max(0, OPTIONS.findIndex((o) => o.key === choice))
    const now = OPTIONS[at]
    const next = OPTIONS[(at + 1) % OPTIONS.length]
    return (
      <button type="button" onClick={() => pick(next.key)} aria-label={`Appearance: ${now.label}. Switch to ${next.label}.`} className={`house-theme-cycle ${className}`.trim()}>
        <IonIcon icon={now.icon} aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className={`house-theme ${className}`.trim()} role="group" aria-label="Appearance">
      {OPTIONS.map((o) => (
        <button key={o.key} type="button" onClick={() => pick(o.key)} aria-pressed={choice === o.key}>
          <IonIcon icon={o.icon} aria-hidden="true" /> {o.label}
        </button>
      ))}
    </div>
  )
}
