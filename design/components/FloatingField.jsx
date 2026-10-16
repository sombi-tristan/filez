'use client'

import { Children, isValidElement } from 'react'
import { IonInput, IonSelect, IonSelectOption, IonTextarea } from '@ionic/react'

/**
 * The form fields: Ionic's floating-label input, textarea and select, outlined. The label sits
 * inside the box at rest and moves up into its border when the field is focused or holds a
 * value. Dressed by `.house-field` in design/house.css.
 *
 * mode="md" on every one: Ionic's outline style exists only in its Android-style mode, so an
 * iPhone would otherwise get a plainer field.
 *
 * `onChange` fires on Ionic's input event, whose target is the field with its `value` on it, so
 * `onChange={(e) => set(e.target.value)}` works. `hint` is Ionic's helper text under the box.
 */

const OUTLINED = { mode: 'md', fill: 'outline' }

/** Only the props that were given: an explicit undefined would clear an Ionic default. */
const given = (props) => Object.fromEntries(Object.entries(props).filter(([, v]) => v !== undefined))

/**
 * A date always shows the browser's own "dd/mm/yyyy", so a label resting inside the box would sit
 * on top of it. Those keep the label up in the border from the start.
 */
const ALWAYS_UP = new Set(['date', 'time', 'datetime-local', 'month', 'week'])

export function FloatingInput({
  id,
  name,
  label,
  hint,
  type = 'text',
  value,
  onChange,
  onFocus,
  onBlur,
  maxLength,
  minLength,
  autoComplete,
  autoCapitalize,
  autoCorrect,
  inputMode,
  readOnly,
  autoFocus,
  className = '',
  children,
  ...rest
}) {
  return (
    <IonInput
      {...OUTLINED}
      labelPlacement={ALWAYS_UP.has(type) ? 'stacked' : 'floating'}
      {...given({
        id,
        name: name || id,
        label,
        helperText: hint,
        type,
        value,
        maxlength: maxLength,
        minlength: minLength,
        autocomplete: autoComplete,
        autocapitalize: autoCapitalize,
        autocorrect: autoCorrect,
        inputmode: inputMode,
        readonly: readOnly,
        autofocus: autoFocus,
        onIonInput: onChange,
        onIonFocus: onFocus,
        onIonBlur: onBlur,
      })}
      className={`house-field ${className}`.trim()}
      {...rest}
    >
      {children}
    </IonInput>
  )
}

export function FloatingTextarea({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  onFocus,
  onBlur,
  rows = 3,
  maxLength,
  autoCapitalize,
  readOnly,
  autoFocus,
  className = '',
  ...rest
}) {
  return (
    <IonTextarea
      {...OUTLINED}
      labelPlacement="floating"
      {...given({
        id,
        name: name || id,
        label,
        helperText: hint,
        value,
        rows,
        maxlength: maxLength,
        autocapitalize: autoCapitalize,
        readonly: readOnly,
        autofocus: autoFocus,
        onIonInput: onChange,
        onIonFocus: onFocus,
        onIonBlur: onBlur,
      })}
      className={`house-field ${className}`.trim()}
      {...rest}
    />
  )
}

/**
 * Takes plain `<option>` children, as a native select does, and hands Ionic its own options,
 * every one of them. An empty value stays a choice: "Not set" is how somebody takes an answer
 * back down, and a placeholder is something nobody can pick.
 */
export function FloatingSelect({
  id,
  name,
  label,
  hint,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  interface: picker = 'popover',
  className = '',
  children,
  ...rest
}) {
  const options = Children.toArray(children).map((child) => {
    if (!isValidElement(child) || child.type !== 'option') return child
    const { value: optionValue = '', disabled, children: text } = child.props
    return (
      <IonSelectOption key={child.key ?? String(optionValue)} value={optionValue} disabled={disabled}>
        {text}
      </IonSelectOption>
    )
  })

  return (
    <IonSelect
      {...OUTLINED}
      labelPlacement="floating"
      {...given({
        id,
        name: name || id,
        label,
        helperText: hint,
        value,
        placeholder,
        interface: picker,
        onIonChange: onChange,
        onIonFocus: onFocus,
        onIonBlur: onBlur,
      })}
      className={`house-field ${className}`.trim()}
      {...rest}
    >
      {options}
    </IonSelect>
  )
}
