'use client'

import { useState, useEffect, useRef } from 'react'
import { defaultReportStart } from '@/lib/reportRange'

const pad = (n) => String(n).padStart(2, '0')

/**
 * The date range of a daily report, as on the Summary report: it opens on this month to
 * today, and Load applies the two dates. viewDate is the day on screen; it moves to the last
 * day when the range changes. pickDay finds that day in the built report.
 */
export function useReportDays() {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  // Desktop build: the month to date, or the last 5 days without a subscription (lib/reportRange.js).
  const monthStartStr = defaultReportStart(todayStr, `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`)

  const [startDate, _setStartDate] = useState(monthStartStr)
  const [endDate, _setEndDate] = useState(todayStr)
  const startDateRef = useRef(monthStartStr)
  const endDateRef = useRef(todayStr)
  const setStartDate = (v) => { startDateRef.current = v; _setStartDate(v) }
  const setEndDate = (v) => { endDateRef.current = v; _setEndDate(v) }
  const [viewDate, setViewDate] = useState(todayStr)
  const [generating, setGenerating] = useState(false)
  const [reportStart, setReportStart] = useState(monthStartStr)
  const [reportEnd, setReportEnd] = useState(todayStr)

  useEffect(() => {
    if (viewDate < reportStart || viewDate > reportEnd) setViewDate(reportEnd)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportStart, reportEnd])

  const handleGenerate = () => {
    const s = startDateRef.current
    const e = endDateRef.current
    if (!s || !e) return
    setGenerating(true)
    setTimeout(() => {
      setReportStart(s)
      setReportEnd(e)
      setGenerating(false)
    }, 2000)
  }

  return { startDate, endDate, setStartDate, setEndDate, generating, handleGenerate, reportStart, reportEnd, viewDate, setViewDate }
}

/** The day on screen in dateReports (the last when viewDate is not in it), and Prev / Next. */
export function pickDay(dateReports, viewDate, setViewDate) {
  const total = dateReports?.length || 0
  if (!total) return { index: -1, total: 0, day: null, goPrev: () => {}, goNext: () => {} }
  const found = dateReports.findIndex((r) => r.date === viewDate)
  const index = found >= 0 ? found : total - 1
  return {
    index,
    total,
    day: dateReports[index],
    goPrev: () => { if (index > 0) setViewDate(dateReports[index - 1].date) },
    goNext: () => { if (index < total - 1) setViewDate(dateReports[index + 1].date) },
  }
}
