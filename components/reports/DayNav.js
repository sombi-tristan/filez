'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtDate } from '@/lib/formatDate'
import { BTN_FRAMED } from '@/components/ui'

/**
 * Prev / Next through a report's days, the date and "n of total" between them, as on the
 * Summary report. Shown only when the range holds more than one day.
 */
export default function DayNav({ date, index, total, onPrev, onNext }) {
  if (total <= 1 || !date) return null
  return (
    <div className="flex items-center justify-between shrink-0 mb-2 px-1 sm:px-[15%]">
      <button
        onClick={onPrev}
        disabled={index <= 0}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium disabled:opacity-30 ${BTN_FRAMED}`}
      >
        <ChevronLeft className="w-4 h-4" /> Prev
      </button>
      <span className="text-sm text-content-muted font-medium">
        {fmtDate(date)}
        <span className="text-content-faint ml-1">({index + 1} of {total})</span>
      </span>
      <button
        onClick={onNext}
        disabled={index >= total - 1}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium disabled:opacity-30 ${BTN_FRAMED}`}
      >
        Next <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
