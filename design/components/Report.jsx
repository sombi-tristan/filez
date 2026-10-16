'use client'

import { useEffect, useRef, useState } from 'react'
import { IonIcon } from '@ionic/react'
import { chevronBack, chevronForward } from 'ionicons/icons'
import { PAGE_SIZE, pageOf } from './paging.js'

/**
 * A report's parts. Compose these; do not draw a table by hand. Dressed by `.house-report-*`
 * in design/house.css. The rules they hold to:
 *
 *   - Right-aligned means tabular: a numeric column is set right and in tabular figures
 *     together, so columns do not jitter down the page.
 *   - Colour must mean something: cells are in the text colour. Green and red are for signed
 *     accounting figures only (`balanceTone`), passed as a <span> so the meaning survives.
 *   - Any list that can run long is paged (`pageSize`), and a total in `foot` is worked out over
 *     ALL rows by the caller and repeats on every page.
 *   - An empty table says so in one quiet line. A whole view with nothing is an EmptyState.
 */

/** A page's frame: one centred column, the controls pinned to its top while the report scrolls. */
export function ReportShell({ controls = null, wide = false, children }) {
  return (
    <div className={`house-report ${wide ? 'house-report-wide' : ''}`.trim()}>
      {controls ? <div className="house-report-controls">{controls}</div> : null}
      {children}
    </div>
  )
}

/** A titled block of a report. `level={2}` for a summary's heading; `action` sits at its end. */
export function ReportSection({ title, level = 3, action = null, className = '', children }) {
  const H = level === 2 ? 'h2' : 'h3'
  return (
    <section className={`house-report-section ${className}`.trim()}>
      {title || action ? (
        <div className="house-report-heading">
          {title ? <H>{title}</H> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** The bordered frame a table scrolls sideways in. For a table too unusual for ReportTable. */
export function TableFrame({ className = '', children }) {
  return <div className={`house-report-frame ${className}`.trim()}>{children}</div>
}

/** Prev, "Page n of m", Next. Draws nothing when there is one page. */
export function Pager({ page, pageCount, onChange }) {
  if (pageCount <= 1) return null
  return (
    <div className="house-report-pager">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 0}>
        <IonIcon icon={chevronBack} aria-hidden="true" /> Prev
      </button>
      <span>
        Page {page + 1} of {pageCount}
      </span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount - 1}>
        Next <IonIcon icon={chevronForward} aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * The standard table.
 *
 *   head        the column headings
 *   rows        an array of rows, each an array of cells (text, or an element)
 *   right       per column, true for a numeric column
 *   foot        the totals row, repeated on every page
 *   empty       what to say with no rows
 *   nowrap      keep every cell on one line (the frame scrolls sideways)
 *   onRowClick  called with the row's index among ALL rows
 *   pageSize    pages the rows; pass PAGE_SIZE
 */
export function ReportTable({ head, rows, right = [], foot = null, empty = 'No data.', nowrap = false, onRowClick = null, pageSize = 0 }) {
  const [asked, setAsked] = useState(0)
  const total = rows?.length || 0

  // A new list starts at its first page.
  useEffect(() => {
    setAsked(0)
  }, [total, pageSize])

  if (!total) return <p className="house-report-none">{empty}</p>

  const { page, count, offset, rows: shown } = pageOf(rows, asked, pageSize)
  const side = (i) => (right[i] ? 'house-report-num' : undefined)

  return (
    <>
      <TableFrame>
        <table className={`house-report-table ${nowrap ? 'house-report-nowrap' : ''}`.trim()}>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col" className={side(i)}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((cells, i) => (
              <tr key={offset + i} className={onRowClick ? 'house-report-opens' : undefined} onClick={onRowClick ? () => onRowClick(offset + i) : undefined}>
                {cells.map((cell, j) => (
                  <td key={j} className={side(j)}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {foot ? (
            <tfoot>
              <tr>
                {foot.map((cell, j) => (
                  <td key={j} className={side(j)}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </TableFrame>
      <Pager page={page} pageCount={count} onChange={setAsked} />
    </>
  )
}

/** A figure with its name over it. `tone` is 'good' or 'bad' for a signed figure. */
export function Stat({ label, value, tone }) {
  return (
    <div className="house-report-stat">
      <p>{label}</p>
      <b className={tone ? `house-report-${tone}` : undefined}>{value}</b>
    </div>
  )
}

/** Stats in a ruled grid: two across on a phone, four on a computer. */
export function StatGrid({ children }) {
  return <div className="house-report-stats">{children}</div>
}

/** A run of label-left, figure-right lines (a profit and loss, a cash breakdown). */
export function BreakdownPanel({ className = '', children }) {
  return <div className={`house-report-lines ${className}`.trim()}>{children}</div>
}

/**
 *   strong  a total line: bold, on a tinted ground
 *   muted   a figure that is context rather than the point
 *   sub     a quiet second line under the label
 *   icon    an ionicons/icons value before the label
 */
export function BreakdownRow({ label, value, strong = false, muted = false, sub = null, icon = null }) {
  return (
    <div className={`house-report-line ${strong ? 'house-report-strong' : ''}`.trim()}>
      {icon ? <IonIcon icon={icon} aria-hidden="true" /> : null}
      <span className="house-report-label">
        {label}
        {sub ? <small>{sub}</small> : null}
      </span>
      <span className={`house-report-num ${muted ? 'house-report-quiet' : ''}`.trim()}>{value}</span>
    </div>
  )
}

/** The class for a signed balance: money owed reads bad, anything else good. */
export const balanceTone = (n) => (Number(n) > 0 ? 'house-report-bad' : 'house-report-good')

export const ALL_TAB = 'all'

/**
 * "All" and one tab per day, pinned to the bottom of a report. The strip scrolls sideways; on a
 * computer two arrows scroll it, since a mouse cannot drag it. A day with nothing entered is
 * quieter than a day with something.
 *
 *   days      [{ date: 'YYYY-MM-DD', dayNum: 3, hasEntry: true }]
 *   value     a date, or ALL_TAB
 *   onChange  called with the date (or ALL_TAB) that was tapped
 */
export function DayTabs({ days, value, onChange, allLabel = 'All' }) {
  const strip = useRef(null)

  // The chosen day is brought into view when it changes from outside.
  useEffect(() => {
    strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [value])

  const scroll = (way) => strip.current?.scrollBy({ left: way * strip.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <div className="house-report-days">
      <button type="button" onClick={() => onChange(ALL_TAB)} aria-current={value === ALL_TAB ? 'true' : undefined} className="house-report-all">
        {allLabel}
      </button>
      <button type="button" className="house-report-arrow" aria-label="Earlier days" onClick={() => scroll(-1)}>
        <IonIcon icon={chevronBack} aria-hidden="true" />
      </button>
      <div className="house-report-strip" ref={strip}>
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => onChange(d.date)}
            aria-current={d.date === value ? 'true' : undefined}
            className={d.hasEntry ? undefined : 'house-report-blank'}
          >
            {d.dayNum}
          </button>
        ))}
      </div>
      <button type="button" className="house-report-arrow" aria-label="Later days" onClick={() => scroll(1)}>
        <IonIcon icon={chevronForward} aria-hidden="true" />
      </button>
    </div>
  )
}

export { PAGE_SIZE }
