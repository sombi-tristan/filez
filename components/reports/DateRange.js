'use client'

import { Loader2 } from 'lucide-react'
import DateInput from '@/components/DateInput'
import { OUTLINE_WITHIN, BTN_PRIMARY } from '@/components/ui'

/**
 * A report's date range and its Load button, on one line: from, to, and Load, which runs the
 * report. Load is a text button the size of the report's other buttons (Edit, Export). The three
 * never wrap apart, so on a phone the dates and the button that acts on them stay together;
 * anything else in the report's controls wraps after them.
 *
 *   disabled    when the range cannot be run (a date missing, or the start after the end)
 *   generating  shows a spinner beside the word while the report is built
 */
export default function DateRange({ start, end, onStart, onEnd, onGenerate, generating = false, disabled = false }) {
  const field = `px-2 py-2.5 text-sm font-medium ${OUTLINE_WITHIN}`
  return (
    <div className="flex flex-nowrap items-center gap-2">
      <DateInput value={start} onChange={onStart} className={field} />
      <span className="text-sm text-content-faint">to</span>
      <DateInput value={end} onChange={onEnd} className={field} />
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating || disabled}
        className={`px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 ${BTN_PRIMARY}`}
      >
        {generating && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        Load
      </button>
    </div>
  )
}
