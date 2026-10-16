'use client'

import { useEffect, useRef, useState } from 'react'
import { IonDatetime, IonIcon, IonModal } from '@ionic/react'
import { calendarOutline } from 'ionicons/icons'
import { FloatingInput } from './FloatingField.jsx'
import { addDays, fromIso, parseDay, toDisplay, toIso } from './dates.js'

/**
 * A day, typed or picked. The field takes what a bookkeeper types (components/dates.js: "15",
 * "15/3", "150326", "t" for today, "y" for yesterday) and settles it when the field is left or
 * Enter is pressed; + and - step a day. The calendar button opens Ionic's own calendar. What
 * cannot be read as a day is said under the field, and what was typed stays.
 *
 *   value     `YYYY-MM-DD`, or '' for none
 *   onChange  called with `YYYY-MM-DD`
 */
export default function DateInput({ id, label = 'Date', value, onChange, className = '' }) {
  const modal = useRef(null)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const d = fromIso(value)
    setTyped(d ? toDisplay(d) : '')
    setError('')
  }, [value])

  const settle = (d) => {
    if (!d) {
      setError('That is not a date. Type it as day-month-year.')
      return
    }
    setError('')
    setTyped(toDisplay(d))
    if (toIso(d) !== value) onChange(toIso(d))
  }

  return (
    <>
      <FloatingInput
        id={id}
        label={label}
        value={typed}
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-YYYY"
        maxLength={10}
        errorText={error}
        className={`house-date ${error ? 'ion-invalid ion-touched' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
        onChange={(e) => {
          setTyped(e.target.value ?? '')
          setError('')
        }}
        onBlur={() => {
          if (typed.trim()) settle(parseDay(typed))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            settle(parseDay(typed))
          } else if (e.key === '+' || e.key === '-') {
            e.preventDefault()
            settle(addDays(parseDay(typed) || new Date(), e.key === '+' ? 1 : -1))
          }
        }}
      >
        <button type="button" slot="end" className="house-date-open" aria-label="Open calendar" onClick={() => setOpen(true)}>
          <IonIcon icon={calendarOutline} aria-hidden="true" />
        </button>
      </FloatingInput>

      <IonModal ref={modal} isOpen={open} onDidDismiss={() => setOpen(false)} className="house-date-modal">
        <IonDatetime
          presentation="date"
          value={fromIso(value) ? value : undefined}
          onIonChange={(e) => {
            const picked = fromIso(String(e.detail.value || '').slice(0, 10))
            if (picked) settle(picked)
            modal.current?.dismiss()
          }}
        />
      </IonModal>
    </>
  )
}
