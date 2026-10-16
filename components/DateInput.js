'use client'

import { useState, useRef, useEffect, useId } from 'react'
import IMask from 'imask'
import { parse, isValid, format, addDays, subDays } from 'date-fns'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Calendar } from 'lucide-react'

/**
 * Smart date input with DD/MM/YYYY display, keyboard shortcuts, and calendar picker.
 * Drop-in replacement for <input type="date" value={} onChange={} />.
 *
 * Props:
 *   value    — YYYY-MM-DD string (same as native date input)
 *   onChange — receives YYYY-MM-DD string (NOT an event object)
 *   className — applied to the outer wrapper div
 */
export default function DateInput({ value, onChange, className = '' }) {
  const uid = useId()
  const inputRef = useRef(null)
  const maskRef = useRef(null)

  const [inputValue, setInputValue] = useState(
    value ? format(new Date(value + 'T00:00:00'), 'dd-MM-yyyy') : ''
  )
  const [error, setError] = useState('')
  const [showCalendar, setShowCalendar] = useState(false)

  // Sync display when value prop changes externally
  useEffect(() => {
    if (value) {
      const formatted = format(new Date(value + 'T00:00:00'), 'dd-MM-yyyy')
      setInputValue(formatted)
    } else {
      setInputValue('')
    }
  }, [value])

  // Apply input mask
  useEffect(() => {
    if (!inputRef.current) return
    maskRef.current = IMask(inputRef.current, {
      mask: '00-00-0000',
      lazy: true,
      overwrite: true,
    })
    return () => maskRef.current?.destroy()
  }, [])

  // Parse flexible date input (Busy-style shortcuts)
  const smartParseDate = (input, refDate = new Date()) => {
    const raw = input.trim()
    if (!raw) return null

    // Letter shortcuts (check BEFORE stripping non-numeric)
    if (raw.toLowerCase() === 't') return refDate
    if (raw.toLowerCase() === 'y') return subDays(refDate, 1)

    const trimmed = raw.replace(/[^0-9/.\-\s]/g, '')
    if (!trimmed) return null

    // Single number → day in current month/year
    if (/^\d{1,2}$/.test(trimmed)) {
      const day = parseInt(trimmed, 10)
      if (day >= 1 && day <= 31) {
        return new Date(refDate.getFullYear(), refDate.getMonth(), day)
      }
    }

    // day/month → current year
    const dayMonthMatch = trimmed.match(/^(\d{1,2})[/.\-\s](\d{1,2})$/)
    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1], 10)
      const month = parseInt(dayMonthMatch[2], 10)
      return new Date(refDate.getFullYear(), month - 1, day)
    }

    // day/month/year
    const fullMatch = trimmed.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2,4})$/)
    if (fullMatch) {
      let year = parseInt(fullMatch[3], 10)
      if (year < 100) year += year < 50 ? 2000 : 1900
      const day = parseInt(fullMatch[1], 10)
      const month = parseInt(fullMatch[2], 10)
      return new Date(year, month - 1, day)
    }

    // Continuous digits: 6 or 8 chars
    if (/^\d{6,8}$/.test(trimmed)) {
      const day = parseInt(trimmed.slice(0, 2), 10)
      const month = parseInt(trimmed.slice(2, 4), 10)
      let year = parseInt(trimmed.slice(4), 10)
      if (trimmed.length === 6) year += year < 50 ? 2000 : 1900
      return new Date(year, month - 1, day)
    }

    // Standard fallback
    const parsed = parse(trimmed, 'dd-MM-yyyy', refDate)
    if (isValid(parsed)) return parsed
    return null
  }

  const commitDate = (dateObj) => {
    if (dateObj && isValid(dateObj)) {
      const iso = format(dateObj, 'yyyy-MM-dd')
      const display = format(dateObj, 'dd-MM-yyyy')
      onChange(iso)
      setInputValue(display)
      setError('')
      return true
    }
    return false
  }

  const handleChange = (e) => {
    setInputValue(e.target.value)
    setError('')
  }

  const handleBlur = () => {
    if (!inputValue.trim()) return
    const parsed = smartParseDate(inputValue)
    if (!commitDate(parsed)) {
      setError('Invalid date')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const parsed = smartParseDate(inputValue)
      if (!commitDate(parsed)) {
        setError('Invalid date')
      }
      return
    }

    if (e.key === '+' || e.key === '-') {
      e.preventDefault()
      const current = smartParseDate(inputValue) || new Date()
      const next = e.key === '+' ? addDays(current, 1) : subDays(current, 1)
      commitDate(next)
    }
  }

  const handleCalendarChange = (date) => {
    if (date && isValid(date)) {
      commitDate(date)
      setShowCalendar(false)
    }
  }

  return (
    // min-w: a full DD-MM-YYYY and the calendar button always fit. Without a floor a phone
    // squeezed a report's date down to "01-."; at this width two dates and the Generate button
    // still share one phone line.
    <div className={`relative min-w-[7.5rem] ${className}`}>
      <div className="flex">
        <input
          ref={inputRef}
          id={uid}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onFocus={(e) => e.target.select()}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="DD-MM-YYYY"
          // A date's own width: an input otherwise asks for twenty characters, which pushed a
          // report's controls onto three lines on a phone.
          size={10}
          autoComplete="off"
          className={`block w-full min-w-0 tabular-nums bg-transparent focus:outline-none placeholder:text-content-faint ${error ? 'text-red-600 dark:text-red-400' : 'text-content'}`}
        />
        <button
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          className="flex items-center px-1 text-content-faint hover:text-content-strong"
          aria-label="Open calendar"
          tabIndex={-1}
        >
          <Calendar className="w-4 h-4" />
        </button>
      </div>

      {showCalendar && (
        <div className="absolute z-50 mt-1 left-0">
          {/* calendarClassName activates the .app-datepicker rules in globals.css, which is
              where this popup is themed. The library ships its own stylesheet, so restyling
              it from here would lose to load order; scoped rules there win instead. */}
          <DatePicker
            selected={value ? new Date(value + 'T00:00:00') : null}
            onChange={handleCalendarChange}
            inline
            dateFormat="dd-MM-yyyy"
            calendarClassName="app-datepicker"
            onClickOutside={() => setShowCalendar(false)}
          />
        </div>
      )}
    </div>
  )
}
