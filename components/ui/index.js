'use client'

/**
 * Shared UI primitives — the enforced-in-code layer of the Premeval design system, ported
 * from store-portal so the two apps look and behave the same.
 *
 * Flat cards, 2px card border (border-card), square corners, one blue accent, semantic
 * tokens for light/dark. Screens compose these instead of re-deriving classes.
 *
 * Two deliberate differences from store-portal's copy:
 *   - Links are lib/nav's Link (Ionic's stack, with next/link's props), not RippleLink.
 *     station-portal has no Ripple primitive, and adding tap-ripple to every row is a
 *     behaviour change, not a styling one.
 *   - Tile / HeroTile / Row take `allowed` + `onBlocked`. store filters destinations a member
 *     cannot open out of the nav entirely; station shows them dimmed and explains on tap.
 *
 * FilterRail is still not ported — no station screen has a filter column yet.
 */

import Link from '@/lib/nav'
import { ChevronRight } from 'lucide-react'

// Shared class fragments.
/**
 * The flat-card outline without a surface, for a panel that brings its own background
 * (a bg-subtle toolbar, a tinted banner). Composing the full CARD there would put bg-surface
 * and bg-subtle both in the class list, and which one wins is decided by their order in the
 * generated stylesheet rather than in the string.
 */
export const CARD_LINE = 'border-card border-primary-500/40 dark:border-primary-400/40'
export const CARD = `bg-surface ${CARD_LINE}`
export const CARD_HOVER = 'hover:border-primary-500 dark:hover:border-primary-400 transition-colors'
export const CHIP_MONO = 'bg-primary-100 text-primary-600 dark:bg-primary-950/50 dark:text-primary-300'
// App-wide control look: translucent blue fill + 2px blue border, darker border when
// highlighted (focus/hover), blue text + icons. Shared by every Button variant and input.
export const OUTLINE = 'border-2 border-primary-500/40 dark:border-primary-400/40 bg-primary-500/10 text-primary-700 dark:text-primary-300 transition-all'

/**
 * The four button looks, exported as class strings as well as being what <Button> renders.
 *
 * Everything-outline: no variant is ever a solid fill. What separates them is how hard the
 * outline is drawn. `framed` is the resting state, a 40% border over a 10% wash. `primary` is
 * the same box at full strength, so a form's Save does not look identical to its Cancel.
 * `danger` keeps the shape in semantic red. `quiet` has no box at all — the way out of a form,
 * with the same padding so a row still lines up.
 *
 * They are exported because most station screens hand-roll their buttons with their own
 * padding, icons and disabled rules, and swapping a class string is a styling change where
 * rewriting them all as <Button> would be a structural one.
 */
export const BTN_FRAMED = `${OUTLINE} hover:bg-primary-500/20 hover:border-primary-600 dark:hover:border-primary-400`
// Sits where framed's hover lands, so its own hover has to go a step further again.
export const BTN_PRIMARY = 'border-2 border-primary-600 dark:border-primary-400 bg-primary-500/20 text-primary-800 dark:text-primary-100 transition-all hover:bg-primary-500/30 dark:hover:border-primary-300'
export const BTN_DANGER = 'border-2 border-red-500/40 dark:border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:border-red-600 dark:hover:border-red-500 transition-all'
export const BTN_QUIET = 'text-content-muted hover:text-content hover:bg-subtle transition-all'

// ---- Report chrome ----
// Mirrors store-portal/components/ui/report.js so a station report and a store report read as
// the same document. Every report border colour flows from REPORT_LINE, so the accent can be
// retuned in one place.
//
// These pages previously each declared `const bdr = 'border border-primary-500/40'` — the right
// colour, but with no dark counterpart, so in dark mode the grid kept the light-mode border
// while everything around it swapped. REPORT_LINE carries both halves.
export const REPORT_LINE = 'border-primary-500/40 dark:border-primary-400/40'
export const REPORT_CARD = `border-card ${REPORT_LINE}`
export const REPORT_RULE = `border-t-2 ${REPORT_LINE}`
// One deliberate difference from store's copy: no `text-xs`. store's ReportTable owns its own
// type scale, whereas each station table sets its own (`text-sm`, `text-xs`, `font-bold`), and
// baking a size in here would silently shrink headers that already read correctly.
export const REPORT_HEAD = 'bg-primary-600 text-white'
// The tint on its own. Station's total rows already carry their own weight (font-bold on a
// Totals row, font-medium on an Opening Balance one), and composing the full REPORT_TOTAL
// would put two font-weight utilities in one class list — which of them wins is decided by
// their order in the generated stylesheet, not in the string.
export const REPORT_TOTAL_FILL = 'bg-primary-500/5'
export const REPORT_TOTAL = `${REPORT_TOTAL_FILL} font-semibold text-content`
// Sub-header / banded group row sitting under a REPORT_HEAD. store has no equivalent (its
// tables are flat), so this keeps the station shape and only supplies the missing dark half —
// `bg-primary-50` alone rendered as a near-white band across a dark table.
export const REPORT_SUBHEAD = 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'

/** Square mono icon chip. `variant="onColor"` for use on a filled brand surface. */
export function IconChip({ icon: Icon, className = 'w-8 h-8', iconClass = 'w-4 h-4', variant = 'mono' }) {
  const styles = variant === 'onColor' ? 'bg-white/20 text-white' : CHIP_MONO
  return (
    <div className={`flex items-center justify-center shrink-0 rounded-full ${styles} ${className}`}>
      <Icon className={iconClass} />
    </div>
  )
}

/** Uppercase section label. */
export function SectionHeader({ children, className = '' }) {
  return (
    <h2 className={`text-sm font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide mb-3 ${className}`}>
      {children}
    </h2>
  )
}

/** Generic flat card container. */
export function Card({ as: As = 'div', className = '', children, ...rest }) {
  return <As className={`${CARD} ${className}`} {...rest}>{children}</As>
}

/** Small circular count badge. Renders nothing at 0. */
export function Badge({ count, className = '' }) {
  if (!count || count <= 0) return null
  return (
    <span className={`min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center text-xs font-bold bg-accent-600 text-white rounded-full ${className}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** Pulsing loading placeholder. Pass `tint` (e.g. bg-white) for colored surfaces. */
export function Skeleton({ className = '', tint = 'bg-content/10' }) {
  return <span className={`inline-block animate-pulse ${tint} ${className}`} />
}

/**
 * Square menu tile: chip, wrapping title, chevron, blue hover. Ported from store-portal so the
 * two launchers read as the same board.
 *
 * `allowed={false}` dims the tile and hands the tap to `onBlocked` instead of navigating.
 * store has no equivalent — it filters hidden destinations out entirely — but station shows a
 * blocked destination dimmed and explains on tap, which tells a member the feature exists and
 * who to ask. Keeping that behaviour is the point of the prop.
 */
export function Tile({ href, label, desc, icon, allowed = true, onBlocked }) {
  const inner = (
    <>
      <ChevronRight className="absolute top-2 right-2 w-4 h-4 text-content-faint" />
      <IconChip icon={icon} className="w-9 h-9 sm:w-10 sm:h-10" iconClass="w-5 h-5" />
      {/* break-words, because the tile is square and the label is not: a word longer than the
          tile ("Product Receipt") would otherwise be clipped mid-word by the overflow. */}
      <p className="text-sm font-semibold text-content leading-tight mt-auto break-words">{label}</p>
      {desc && <p className="text-[11px] text-content-muted truncate">{desc}</p>}
    </>
  )
  const cls = `relative aspect-square flex flex-col p-3 ${CARD} ${allowed ? CARD_HOVER : 'opacity-50'}`
  if (!allowed) {
    return <button type="button" onClick={onBlocked} className={`${cls} text-left w-full`}>{inner}</button>
  }
  return <Link href={href} className={cls}>{inner}</Link>
}

/** Large hero tile. `solid` = filled brand-blue primary action; else tinted secondary. */
export function HeroTile({ href, label, desc, icon, solid, badge, allowed = true, onBlocked }) {
  const inner = (
    <>
      <Badge count={badge} className="absolute top-2 right-2" />
      <IconChip icon={icon} variant={solid ? 'onColor' : 'mono'} className="w-10 h-10" iconClass="w-5 h-5" />
      <div className="mt-2">
        <p className={`text-base font-bold ${solid ? 'text-white' : 'text-content'}`}>{label}</p>
        <p className={`text-xs ${solid ? 'text-white/80' : 'text-content-muted'}`}>{desc}</p>
      </div>
    </>
  )
  const cls = `relative flex flex-col justify-between p-3 min-h-[6rem] sm:min-h-[7rem] border-card transition-colors ${
    solid
      ? 'bg-primary-600 text-white border-primary-500/40 dark:border-primary-400/40'
      : `bg-primary-50 dark:bg-primary-950/30 border-primary-500/40 dark:border-primary-400/40 ${CARD_HOVER}`
  } ${allowed ? '' : 'opacity-50'}`
  if (!allowed) {
    return <button type="button" onClick={onBlocked} className={`${cls} text-left w-full`}>{inner}</button>
  }
  return <Link href={href} className={cls}>{inner}</Link>
}

/** Bordered container that groups Rows with dividers. */
export function RowGroup({ className = '', children }) {
  return <div className={`${CARD} divide-y divide-gray-300 dark:divide-white/15 ${className}`}>{children}</div>
}

/** One-line list row (inside a RowGroup). Optional count badge before the chevron. */
export function Row({ href, label, desc, icon, badge, allowed = true, onBlocked }) {
  const inner = (
    <>
      <IconChip icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-content truncate">{label}</p>
        <p className="text-[11px] text-content-muted truncate">{desc}</p>
      </div>
      <Badge count={badge} />
      <ChevronRight className="w-4 h-4 shrink-0 text-content-faint" />
    </>
  )
  const cls = 'flex items-center gap-3 px-3 py-3 transition-colors'
  if (!allowed) {
    return (
      <button type="button" onClick={onBlocked} className={`${cls} w-full text-left opacity-50`}>{inner}</button>
    )
  }
  return (
    <Link href={href} className={`${cls} hover:bg-subtle hover:ring-2 hover:ring-inset hover:ring-primary-500`}>
      {inner}
    </Link>
  )
}

/**
 * Action button/link. Internal href → Link; external href (target set) → plain anchor;
 * otherwise a <button>.
 *
 * Everything-outline design: no variant is ever a solid fill. What separates them is how
 * hard the outline is drawn. `framed` is the resting state, a 40% border over a 10% wash.
 * `primary` is the same box at full strength, so a form's Save does not look identical to
 * its Cancel. `danger` keeps the shape in semantic red. `quiet` has no box at all — the way
 * out of a form, with the same padding so a row still lines up.
 */
export function Button({ href, onClick, icon: Icon, children, target, rel, type = 'button', variant = 'framed', size = 'md', iconClass = 'w-4 h-4', className = '', disabled }) {
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-3 py-2 text-sm' }
  const variants = { framed: BTN_FRAMED, primary: BTN_PRIMARY, danger: BTN_DANGER, quiet: BTN_QUIET }
  const cls = `inline-flex items-center justify-center gap-1.5 font-semibold whitespace-nowrap disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`
  const inner = <>{Icon && <Icon className={iconClass} />}{children}</>
  // onClick is forwarded on the anchor branch too: an external link can still have something
  // to do on the way out (closing the sheet it was opened from).
  if (href && target) return <a href={href} target={target} rel={rel} onClick={onClick} className={cls}>{inner}</a>
  if (href) return <Link href={href} className={cls}>{inner}</Link>
  return <button type={type} onClick={onClick} disabled={disabled} className={cls}>{inner}</button>
}

/**
 * Centered empty state: icon, title, optional supporting line, optional action.
 *
 * For a WHOLE view that has nothing to show. An empty table INSIDE a populated view should
 * keep its quiet one-line form, so a page of sections does not turn into a page of
 * twelve-rem placeholders.
 */
export function EmptyState({ icon: Icon, title, children, action, className = '' }) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {Icon && <Icon className="w-10 h-10 text-content-faint mx-auto mb-3" />}
      {title && <p className="text-sm font-semibold text-content">{title}</p>}
      {children && <p className="text-sm text-content-muted mt-0.5">{children}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  )
}

// ---- Form controls ----
// Material-style field: just a bottom border (no box, no fill), underline darkening on focus.
// Buttons keep the full OUTLINE box — this style is text/number inputs and selects only.
/**
 * The underline without a width, for the few fields that are not full-bleed: a quantity box
 * in a table row, a meter reading beside a pump name. Composing `${INPUT} w-20` instead would
 * leave `w-full` and `w-20` both in the class list, and which one wins is decided by their
 * order in the generated stylesheet rather than in the string.
 */
export const INPUT_BASE = `border-b-2 border-primary-500/40 dark:border-primary-400/40 bg-primary-500/10 focus:bg-primary-500/15 px-2 py-2 text-sm text-content transition-colors focus:border-primary-600 dark:focus:border-primary-400 focus:outline-none disabled:opacity-50 placeholder:text-content-faint`
export const INPUT = `w-full ${INPUT_BASE}`
/**
 * The underline with no padding at all, for a field whose insets are set by an adornment — a
 * search icon absolutely positioned at `pl-10`, a currency prefix. Composing INPUT_BASE there
 * would leave `px-2` and `pl-10` both in the class list, and which one wins is decided by their
 * order in the generated stylesheet rather than in the string.
 */
export const INPUT_BARE = 'border-b-2 border-primary-500/40 dark:border-primary-400/40 bg-primary-500/10 focus:bg-primary-500/15 text-sm text-content transition-colors focus:border-primary-600 dark:focus:border-primary-400 focus:outline-none disabled:opacity-50 placeholder:text-content-faint'
export const LABEL = 'block text-sm font-semibold text-content mb-1.5'

/**
 * The same underline for a control you cannot put INPUT on directly: a SearchableSelect
 * (whose className lands on its wrapper div, not its trigger), or an input with something
 * beside it such as a currency prefix.
 *
 * Deliberately NO fill. The tint on INPUT marks a box you type into; a select or a picker is
 * something you choose from, and colouring those too turns every control into a filled slab.
 *
 * It is `focus-within` rather than `focus` for that reason: the element carrying the border
 * is never the element that takes focus. Carries no padding, since the control inside brings
 * its own and doubling them makes a field visibly taller than its neighbours.
 */
export const FIELD = 'w-full border-b-2 border-primary-500/40 dark:border-primary-400/40 bg-transparent transition-colors focus-within:border-primary-600 dark:focus-within:border-primary-400'

/**
 * The OUTLINE box for a control whose className lands on a WRAPPER rather than on the input
 * itself — which is what DateInput does (see its own doc comment: "className — applied to the
 * outer wrapper div"). A div never receives :focus, so the highlight has to key off
 * focus-within or it never fires at all.
 *
 * Mirrors the box store-portal/components/ReportControls.js:37 wraps its own DateInput in.
 */
export const OUTLINE_WITHIN = 'border-2 border-primary-500/40 dark:border-primary-400/40 bg-primary-500/10 text-primary-700 dark:text-primary-300 focus-within:border-primary-600 dark:focus-within:border-primary-400 transition-colors'

// ---- Entry-form chrome ----
/**
 * Mirrors store-portal/components/EntryForm.js, which was itself ported FROM these screens and
 * then evolved. The shape is station's own and stays: a form is a bordered GRID whose lines are
 * the field boundaries, each cell a label above a borderless input, so the eye reads a ledger
 * page rather than a column of floating boxes.
 *
 * What changes here is only colour. These fields carried `bg-transparent focus:bg-primary-50` —
 * no resting fill at all, and a focus tint with no dark counterpart, so focusing a field in dark
 * mode flashed a near-white block. The alpha fills below read correctly in both themes.
 *
 * Deliberately NOT the tinted-underline INPUT: underlines suit a settings page with a handful of
 * fields, a grid suits a form someone fills in every day at speed. The two never share a screen.
 */
export const ENTRY_FILL = 'bg-primary-500/[0.12] focus:bg-primary-500/[0.26] transition-colors'
/** The same fill for a wrapper-className control (DateInput), which needs focus-within. */
export const ENTRY_FILL_WITHIN = 'bg-primary-500/[0.12] focus-within:bg-primary-500/[0.26] transition-colors'
export const ENTRY_INPUT = `w-full px-3 py-2.5 text-base ${ENTRY_FILL} text-content placeholder:text-content-faint focus:outline-none`
/** A DateInput inside a cell: the same metrics as ENTRY_INPUT, with the wrapper-safe fill. */
export const ENTRY_DATE = `w-full px-3 py-2.5 text-base ${ENTRY_FILL_WITHIN} text-content`
/**
 * A SearchableSelect inside a cell. Same story as ENTRY_DATE — its className lands on the
 * component's wrapper while its trigger stays transparent and carries the padding, so the fill
 * goes on the wrapper and has to deepen on focus-within.
 *
 * Passed by the CALLER rather than baked into SearchableSelect, because that component is also
 * used outside entry forms (report controls, admin settings, subscribe), where a filled slab is
 * not wanted. No metrics here, unlike ENTRY_DATE — the trigger supplies px-3 py-2.5 of its own.
 */
export const ENTRY_SELECT = `w-full ${ENTRY_FILL_WITHIN}`
/**
 * The entry grid's own outline and its cell dividers. They need different utilities: a divider
 * sits on the CHILD elements, so border-* on the parent colours only the parent's own edge and
 * leaves the dividers on Tailwind's default grey.
 */
export const ENTRY_LINE = 'border-primary-500/40 dark:border-primary-400/40'
export const ENTRY_DIVIDE = 'divide-primary-500/40 dark:divide-primary-400/40'

export function Label({ children, className = '', ...rest }) {
  return <label className={`${LABEL} ${className}`} {...rest}>{children}</label>
}

export function Input({ className = '', ...props }) {
  return <input className={`${INPUT} ${className}`} {...props} />
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${INPUT} ${className}`} {...props} />
}

/** Label + control + optional hint/error text. */
export function Field({ label, hint, error, htmlFor, className = '', children }) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error
        ? <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
        : hint ? <p className="text-xs text-content-muted mt-1">{hint}</p> : null}
    </div>
  )
}
