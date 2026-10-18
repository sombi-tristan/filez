'use client'

import { Loader2 } from 'lucide-react'
import DateInput from '@/components/DateInput'
import { OUTLINE_WITHIN, BTN_PRIMARY } from '@/components/ui'
import { rangeAllowed, rangeDays, FREE_REPORT_DAYS } from '@/lib/reportRange'

/**
 * A report's date range and its Load button, on one line: from, to, and Load, which runs the
 * report. Load is a text button the size of the report's other buttons (Edit, Export). The three
 * never wrap apart, so on a phone the dates and the button that acts on them stay together;
 * anything else in the report's controls wraps after them.
 *
 *   disabled    when the range cannot be run (a date missing, or the start after the end)
 *   generating  shows a spinner beside the word while the report is built
 *
 * Desktop build: without a subscription a report covers at most the free days, anywhere in
 * time (lib/reportRange.js). Like the audit report's 32 days, each date moves on its own, and a
 * longer range greys out Load with a line under the dates saying so. The banner at the top
 * of the report says so too (components/desktop/LicenceGate.js FreeReportBanner).
 */
export default function DateRange({ start, end, onStart, onEnd, onGenerate, generating = false, disabled = false }) {
  const field = `px-2 py-2.5 text-sm font-medium ${OUTLINE_WITHIN}`
  const allowed = rangeAllowed(start, end)
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-nowrap items-center gap-2">
        <DateInput value={start} onChange={onStart} className={field} />
        <span className="text-sm text-content-faint">to</span>
        <DateInput value={end} onChange={onEnd} className={field} />
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || disabled || !allowed}
          className={`px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 ${BTN_PRIMARY}`}
        >
          {generating && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Load
        </button>
      </div>
      {!allowed && start <= end && (
        <p className="text-xs text-red-500">Free plan: up to {FREE_REPORT_DAYS} days ({rangeDays(start, end)} days selected).</p>
      )}
    </div>
  )
}
