'use client'

import { useRouter } from '@/lib/nav'
import { IonIcon } from '@ionic/react'
import {
  addOutline, chevronBack, chevronForward, documentTextOutline,
  listOutline, trashOutline,
} from 'ionicons/icons'
import { Button, EmptyState, Spinner, Tabs, Toast } from '@/design'
import DateInput from '@/components/DateInput'
import { ENTRY_INPUT, ENTRY_DATE, ENTRY_LINE } from '@/components/ui'

import { adjacentDates, cleanNumber } from '@/lib/entryInput'

export { SubscribeNotice } from '@/components/entries/EntryListParts'

/**
 * The parts every entry screen is built from, so the five entry types work the same way on a
 * phone: the day pinned at the top with arrows to the day before and after, one card per entry
 * with its fields stacked, and Save pinned at the bottom in thumb reach.
 *
 * These are layout only. Loading, saving and the sync queue stay in each screen and its
 * repository.
 */

export { adjacentDates }

/* ── Form screen ──────────────────────────────────────────────────────────── */

/**
 * The page around an entry form. The bottom padding below lg keeps the last field clear of
 * the pinned action bar.
 */
export function EntryScreen({ children }) {
  return <div className="max-w-3xl mx-auto px-4 sm:px-8 pt-3 pb-36 lg:pb-10">{children}</div>
}

/**
 * The day being entered, pinned to the top of the screen's content so it never scrolls away.
 * The arrows open the saved day before or after in place (the same screen, not a new one on
 * the stack), so a day can be checked without going back to the list.
 *
 * Nothing here clips what overflows it: the date field's calendar opens below the field and
 * has to show over the cards.
 */
export function DayBar({ label = 'Date', value, onChange, prevHref, nextHref }) {
  const router = useRouter()
  const arrow = 'flex items-center justify-center w-12 shrink-0 text-content-muted hover:bg-subtle hover:text-content disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <div className="sticky top-0 z-20 -mx-4 sm:mx-0 mb-4 px-4 sm:px-0 py-2 bg-canvas">
      <div className={`flex items-stretch border-card ${ENTRY_LINE} rounded-house bg-canvas`}>
        <button
          type="button"
          onClick={() => prevHref && router.replace(prevHref)}
          disabled={!prevHref}
          aria-label="Previous saved day"
          className={`${arrow} border-r-2 border-line`}
        >
          <IonIcon icon={chevronBack} className="text-2xl" aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <label className="block text-xs text-content-muted px-3 pt-1 font-semibold">{label}</label>
          <DateInput value={value} onChange={onChange} className={ENTRY_DATE} />
        </div>
        <button
          type="button"
          onClick={() => nextHref && router.replace(nextHref)}
          disabled={!nextHref}
          aria-label="Next saved day"
          className={`${arrow} border-l-2 border-line`}
        >
          <IonIcon icon={chevronForward} className="text-2xl" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/**
 * One entry: a titled card, with a way to remove it when there is more than one. It does not
 * clip its contents, so a date field's calendar can open over the card below.
 */
export function EntryCard({ title, onRemove, children }) {
  return (
    <section className={`border-card ${ENTRY_LINE} rounded-house mb-4`}>
      <div className="flex items-center justify-between min-h-[44px] pl-3 bg-subtle border-b-2 border-line rounded-t-[2px]">
        <h2 className="text-[15px] font-semibold text-content">{title}</h2>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            className="flex items-center gap-1.5 h-11 px-3 text-[15px] text-red-600 dark:text-red-400 hover:bg-red-500/10"
          >
            <IonIcon icon={trashOutline} aria-hidden="true" /> Remove
          </button>
        )}
      </div>
      <div className="divide-y-2 divide-line">{children}</div>
    </section>
  )
}

/** The quiet heading over a group of fields inside a card. */
export function FieldGroup({ title, aside, children }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-subtle">
        <span className="text-[13px] text-content-muted font-semibold uppercase tracking-wide">{title}</span>
        {aside}
      </div>
      {children}
    </>
  )
}

/**
 * Fields side by side. They stack on a phone unless `keep` says the row stays as it is (three
 * short numbers fit; three names do not).
 */
export function FieldRow({ cols = 2, keep = false, children }) {
  const grid = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[cols]
  const kept = { 2: 'grid-cols-2', 3: 'grid-cols-3' }[cols]
  return (
    <div className={keep
      ? `grid ${kept} divide-x-2 divide-line`
      : `grid grid-cols-1 ${grid} divide-y-2 divide-line sm:divide-y-0 sm:divide-x-2`}
    >
      {children}
    </div>
  )
}

/** A label over its field, inside a card. */
export function Field({ label, htmlFor, children }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="block text-[13px] text-content-muted px-3 pt-1.5 font-semibold">{label}</label>
      {children}
    </div>
  )
}

/**
 * A number field that brings up the number pad and takes only digits and one point. A plain
 * text input with inputMode rather than type="number": a number input swallows commas and
 * points silently on some phone keyboards and changes value when scrolled over.
 */
export function NumberInput({ value, onValue, placeholder, className = ENTRY_INPUT, ...rest }) {
  return (
    <input
      type="text"
      inputMode="decimal"
      enterKeyHint="next"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onValue(cleanNumber(e.target.value))
      }}
      className={className}
      {...rest}
    />
  )
}

/** Another entry on the same day: a full-width target under the last card. */
export function AddEntryButton({ onClick, label = 'Add another entry' }) {
  return (
    <Button variant="secondary" icon={addOutline} onClick={onClick} className="mb-4">
      {label}
    </Button>
  )
}

/**
 * Save, pinned to the bottom of a phone's screen where the thumb is, and in the flow at the end
 * of the form on a computer. It must sit inside the <form>: the Save button submits it.
 *
 * `error` is shown as the house toast; `onErrorDone` clears it, so the same message can show
 * again on a second try.
 */
export function SaveBar({ listHref, saving, saved, isEditing, disabled, error, onErrorDone }) {
  const router = useRouter()
  const label = saved ? 'Saved' : saving ? 'Saving…' : isEditing ? 'Update' : 'Save'
  return (
    <>
      <div
        className="entry-actionbar fixed lg:static inset-x-0 bottom-0 z-30 lg:mt-4 px-4 lg:px-0 pt-3 lg:pt-0 bg-canvas border-t-2 lg:border-t-0 border-line"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto flex gap-3">
          <div className="w-1/3 lg:w-40">
            <Button
              variant="neutral"
              size="large"
              icon={listOutline}
              onClick={(e) => { e.preventDefault(); router.push(listHref) }}
            >
              Entries
            </Button>
          </div>
          <div className="flex-1">
            <Button type="submit" size="large" disabled={saving || saved || disabled}>
              {saving ? <span className="mr-2 inline-flex"><Spinner size={20} label="Saving" /></span> : null}
              {label}
            </Button>
          </div>
        </div>
      </div>
      <Toast onDone={onErrorDone}>{error}</Toast>
    </>
  )
}

/** The screen while an entry form reads the day from the device. */
export function EntryLoading() {
  return <div className="flex justify-center py-20"><Spinner /></div>
}

/** The station has nothing to enter against yet (no tanks, no banks). */
export function NotConfigured({ orgId }) {
  const router = useRouter()
  return (
    <EntryScreen>
      <EmptyState
        icon={documentTextOutline}
        title="Station not configured"
        action={(
          <Button onClick={(e) => { e.preventDefault(); router.push(`/dashboard/stations/${orgId}/settings`) }}>
            Go to Settings
          </Button>
        )}
      >
        Set up your station in Settings before creating entries.
      </EmptyState>
    </EntryScreen>
  )
}

/**
 * Which entry of the day is open, for the forms long enough to show one at a time (daily
 * sales, product receipt). Hidden while there is only one, so a single entry is just a card.
 */
export function EntryTabs({ count, active, onChange }) {
  if (count < 2) return null
  return (
    <div className="mb-3 border-b-2 border-line">
      <Tabs
        label="Entries for this day"
        items={Array.from({ length: count }, (_, i) => ({ id: String(i), label: `Entry ${i + 1}` }))}
        value={String(active)}
        onChange={(id) => onChange(Number(id))}
      />
    </div>
  )
}
