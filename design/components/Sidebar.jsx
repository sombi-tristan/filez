'use client'

import { useState } from 'react'
import { IonAccordion, IonAccordionGroup, IonIcon, IonItem, IonLabel, useIonRouter } from '@ionic/react'
import { checkmark, chevronExpandOutline } from 'ionicons/icons'
import Avatar from './Avatar.jsx'
import { Badge } from './Card.jsx'
import { BottomSheet } from './Sheet.jsx'

/**
 * The parts of a business app's sidebar. `Sidebar` is the column itself: put it in an IonMenu
 * (a drawer on a phone) inside an IonSplitPane (always open on a computer). In the neutrals,
 * with the accent only on the current row: a rail down its edge and its words.
 * Dressed by `.house-side` in design/house.css.
 */
export function Sidebar({ children, label = 'Main' }) {
  return (
    <nav className="house-side" aria-label={label}>
      {children}
    </nav>
  )
}

/** The app's mark and name at the head of the sidebar. `mark` is any element (a logo). */
export function SidebarBrand({ mark, name }) {
  return (
    <div className="house-side-brand">
      {mark}
      <span>{name}</span>
    </div>
  )
}

/**
 * Which business (or station, or shop) is open, and the way to another. With one option, or
 * none, it only says where you are.
 *
 *   options   [{ id, title, subtitle }]
 *   onPick    called with the option that was tapped
 */
export function SidebarSwitcher({ title, subtitle, avatar = null, options = [], currentId, onPick }) {
  const [open, setOpen] = useState(false)
  const switchable = options.length > 1
  const face = avatar || <span className="house-side-initial">{String(title || '?').trim().charAt(0).toUpperCase()}</span>
  const words = (
    <>
      {face}
      <span className="house-side-words">
        <b>{title}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </>
  )
  if (!switchable) return <div className="house-side-switch">{words}</div>
  return (
    <>
      <button type="button" className="house-side-switch" onClick={() => setOpen(true)} aria-haspopup="listbox">
        {words}
        <IonIcon icon={chevronExpandOutline} aria-hidden="true" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} label="Switch">
        <ul className="house-side-options" role="listbox">
          {options.map((o) => (
            <li key={o.id} role="option" aria-selected={o.id === currentId}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  onPick?.(o)
                }}
              >
                <span className="house-side-words">
                  <b>{o.title}</b>
                  {o.subtitle ? <small>{o.subtitle}</small> : null}
                </span>
                {o.id === currentId ? <IonIcon icon={checkmark} aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  )
}

/** The small heading over a group of rows. `trailing` sits at its end (a count, a button). */
export function SidebarGroupLabel({ children, trailing = null }) {
  return (
    <div className="house-side-group">
      <span>{children}</span>
      {trailing}
    </div>
  )
}

/**
 * The groups of a long menu as accordions, one open at a time: Ionic's IonAccordionGroup.
 * Opening a group closes the one that was open; tapping the open one closes it.
 *
 *   value     the open group's `value`, or '' for none
 *   onChange  called with the group that was opened, or '' when the open one was closed
 *
 * The caller owns which is open, so it can open the group holding the screen that is shown.
 */
export function SidebarSections({ value, onChange, children }) {
  return (
    <IonAccordionGroup
      className="house-side-sections"
      value={value || undefined}
      onIonChange={(e) => {
        // ionChange bubbles: answer only this group's own change, not a nested control's.
        if (e.target !== e.currentTarget) return
        onChange?.(e.detail.value || '')
      }}
    >
      {children}
    </IonAccordionGroup>
  )
}

/** One group in SidebarSections: its heading, and its rows when open. `trailing` sits at the heading's end (a count). */
export function SidebarSection({ value, label, trailing = null, children }) {
  return (
    <IonAccordion value={value} className="house-side-section">
      <IonItem slot="header" lines="none" className="house-side-section-head">
        <IonLabel>{label}</IonLabel>
        {trailing}
      </IonItem>
      <div slot="content">
        {children}
      </div>
    </IonAccordion>
  )
}

/** One destination. `active` marks the screen that is open. `icon` is an ionicons/icons value. */
export function SidebarNavRow({ href, label, icon, active = false, badge, onClick }) {
  const router = useIonRouter()
  return (
    <button
      type="button"
      className={`house-side-row ${active ? 'house-side-on' : ''}`.trim()}
      aria-current={active ? 'page' : undefined}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (href) router.push(href)
      }}
    >
      {icon ? <IonIcon icon={icon} aria-hidden="true" /> : null}
      <span>{label}</span>
      <Badge count={badge} />
    </button>
  )
}

/** Who is signed in, at the foot of the sidebar. `action` sits at its end (a ThemeControl). */
export function SidebarUserFooter({ name, subtitle, avatar = null, action = null }) {
  return (
    <div className="house-side-foot">
      {avatar || <Avatar size={32} />}
      <span className="house-side-words">
        <b>{name}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      {action}
    </div>
  )
}
