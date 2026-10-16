'use client'

import { useState } from 'react'
import { IonIcon, IonSearchbar } from '@ionic/react'
import { checkmark, chevronDown } from 'ionicons/icons'
import { BottomSheet } from './Sheet.jsx'
import { fuzzyFilter } from './fuzzy.js'

/**
 * A select for a long list (products, customers, accounts): the field opens a sheet with a
 * search box over the options, and typing narrows them, best match first (components/fuzzy.js).
 * For a handful of options use FloatingSelect.
 *
 *   options   [{ value, label, sub }]; `sub` is a quiet second word (a code, a balance)
 *   value     the chosen value
 *   onChange  called with the value that was tapped
 *   label     the field's name, over the value
 *
 * Dressed by `.house-pick` in design/house.css.
 */
export default function SearchableSelect({ value, onChange, options = [], label, placeholder = 'Choose', disabled = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const chosen = options.find((o) => String(o.value) === String(value))
  const shown = fuzzyFilter(options, typed.trim())

  const shut = () => {
    setOpen(false)
    setTyped('')
  }

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={`house-pick ${className}`.trim()} aria-haspopup="listbox">
        <span className="house-pick-words">
          {label ? <span className="house-pick-label">{label}</span> : null}
          <span className={chosen ? 'house-pick-value' : 'house-pick-value house-pick-empty'}>
            {chosen ? chosen.label : placeholder}
            {chosen?.sub ? <small> {chosen.sub}</small> : null}
          </span>
        </span>
        <IonIcon icon={chevronDown} aria-hidden="true" />
      </button>

      <BottomSheet open={open} onClose={shut} label={label || placeholder}>
        <div className="house-pick-sheet">
          <IonSearchbar value={typed} onIonInput={(e) => setTyped(e.detail.value ?? '')} placeholder="Search" debounce={0} />
          <ul role="listbox" aria-label={label || placeholder}>
            {shown.length === 0 ? <li className="house-pick-none">No matches</li> : null}
            {shown.map((o) => {
              const on = String(o.value) === String(value)
              return (
                <li key={o.value} role="option" aria-selected={on}>
                  <button
                    type="button"
                    className={on ? 'house-pick-on' : undefined}
                    onClick={() => {
                      onChange(o.value)
                      shut()
                    }}
                  >
                    <span>{o.label}</span>
                    {o.sub ? <small>{o.sub}</small> : null}
                    {on ? <IonIcon icon={checkmark} aria-hidden="true" /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </BottomSheet>
    </>
  )
}
