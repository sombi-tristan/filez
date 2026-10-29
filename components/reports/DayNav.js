'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { fmtDate } from '@/lib/formatDate'
import { BTN_FRAMED } from '@/components/ui'

/**
 * Walking a daily report's days, on the Summary and Consumption & Fuel Stock reports:
 *   DayTitle  the day on screen, big and bold, above the day's tables
 *   DayNav    Prev / Next at the bottom, under the tables, with "n of total" between them;
 *             shown only when the range holds more than one day
 */
export function DayTitle({ date }) {
  if (!date) return null
  return (
    <div className="shrink-0 pb-2 px-1 sm:px-[15%] text-center text-lg font-bold text-content">
      {fmtDate(date)}
    </div>
  )
}

export default function DayNav({ index, total, onPrev, onNext }) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-between shrink-0 pb-3 px-1 sm:px-[15%]">
      <button
        onClick={onPrev}
        disabled={index <= 0}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium disabled:opacity-30 ${BTN_FRAMED}`}
      >
        <ChevronLeft className="w-4 h-4" /> Prev
      </button>
      <span className="text-xs text-content-faint">{index + 1} of {total}</span>
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
