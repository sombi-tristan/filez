'use client'

import { refreshOutline } from 'ionicons/icons'
import { IconButton, Spinner } from '@/design'
import DateInput from '@/components/DateInput'
import { OUTLINE_WITHIN } from '@/components/ui'

/**
 * A report's date range and its Generate button, on one line: from, to, and a round icon that
 * runs the report. The button is a square box (report-generate in app/globals.css), not the
 * house's round icon button. The three never wrap apart, so on a phone the dates and the button that
 * acts on them stay together; anything else in the report's controls wraps after them.
 *
 *   disabled    when the range cannot be run (a date missing, or the start after the end)
 *   generating  shows a spinner in place of the icon while the report is built
 */
export default function DateRange({ start, end, onStart, onEnd, onGenerate, generating = false, disabled = false }) {
  const field = `px-2 py-2.5 text-sm font-medium ${OUTLINE_WITHIN}`
  return (
    <div className="flex flex-nowrap items-center gap-2">
      <DateInput value={start} onChange={onStart} className={field} />
      <span className="text-sm text-content-faint">to</span>
      <DateInput value={end} onChange={onEnd} className={field} />
      {generating ? (
        <span className="inline-flex w-12 h-12 items-center justify-center" aria-label="Generating report">
          <Spinner size={22} label="Generating report" />
        </span>
      ) : (
        <IconButton icon={refreshOutline} label="Generate report" variant="primary" className="report-generate" onClick={onGenerate} disabled={disabled} />
      )}
    </div>
  )
}
