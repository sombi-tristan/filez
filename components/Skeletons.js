'use client'

import { Skeleton } from '@/design'

/**
 * Loading placeholders in the shape of what is coming, from the house Skeleton (design/), in
 * place of a spinner in the middle of an empty screen. One per kind of screen:
 *   FormSkeleton      an entry form: the day bar, then cards of label and field
 *   ListSkeleton      an entry list: day rows
 *   ReportSkeleton    a report: its date range, then tables (ReportTablesSkeleton alone, for a
 *                     report whose top bar is already showing)
 *   HomeSkeleton      the station home: the station card, the entry and report tiles
 *   StationsSkeleton  the station picker: the station cards
 *   PageSkeleton      anything else: a heading and lines
 */

const Field = () => (
  <div className="py-2">
    <Skeleton width="30%" height={12} />
    <Skeleton height={40} style={{ marginTop: 8 }} />
  </div>
)

export function FormSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-4" aria-busy="true" aria-label="Loading">
      <div className="flex gap-3 mb-4">
        <Skeleton width={110} height={40} />
        <Skeleton height={40} style={{ flex: 1 }} />
      </div>
      <Skeleton height={52} style={{ marginBottom: 16 }} />
      {[0, 1].map((c) => (
        <div key={c} className="p-3 mb-4 border border-line">
          <Skeleton width="40%" height={16} style={{ marginBottom: 8 }} />
          <Field /><Field /><Field />
        </div>
      ))}
    </div>
  )
}

export function ListSkeleton({ rows = 6 }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-4" aria-busy="true" aria-label="Loading">
      <Skeleton width="35%" height={18} style={{ marginBottom: 16 }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-line">
          <div className="flex-1">
            <Skeleton width="45%" height={14} />
            <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
          </div>
          <Skeleton width={16} height={16} />
        </div>
      ))}
    </div>
  )
}

export function ReportTablesSkeleton({ tables = 3 }) {
  return (
    <div className="px-1 sm:px-[15%] py-2" aria-busy="true" aria-label="Loading">
      <Skeleton width="45%" height={22} style={{ margin: '0 auto 14px' }} />
      {Array.from({ length: tables }, (_, t) => (
        <div key={t} className="mb-5">
          <Skeleton height={24} style={{ marginBottom: 4 }} />
          {Array.from({ length: t === 0 ? 6 : 3 }, (_, r) => (
            <div key={r} className="flex gap-1 mb-1">
              <Skeleton width="28%" height={20} />
              <Skeleton height={20} style={{ flex: 1 }} />
              <Skeleton height={20} style={{ flex: 1 }} />
              <Skeleton height={20} style={{ flex: 1 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ReportSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto px-2 sm:px-6">
      <div className="flex justify-end gap-2 py-3">
        <Skeleton width={120} height={38} />
        <Skeleton width={120} height={38} />
        <Skeleton width={64} height={38} />
      </div>
      <ReportTablesSkeleton />
    </div>
  )
}

export function HomeSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-8" aria-busy="true" aria-label="Loading">
      <Skeleton height={150} style={{ marginBottom: 16 }} />
      <div className="flex justify-between mb-4">
        <Skeleton width={130} height={40} />
        <Skeleton width={130} height={40} />
      </div>
      <div className="p-3 border border-line mb-6">
        <Skeleton width="25%" height={14} style={{ marginBottom: 12 }} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height={104} />)}
        </div>
      </div>
      <div className="p-3 border border-line">
        <Skeleton width="25%" height={14} style={{ marginBottom: 12 }} />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={104} />)}
        </div>
      </div>
    </div>
  )
}

export function StationsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6" aria-busy="true" aria-label="Loading">
      <Skeleton width="55%" height={22} />
      <Skeleton width="40%" height={14} style={{ marginTop: 8, marginBottom: 24 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 mb-3 border border-line">
          <Skeleton width={40} height={40} round />
          <div className="flex-1">
            <Skeleton width="50%" height={16} />
            <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** The app opening, before its shell (components/shell/IonicShell.js) has loaded: a top bar and a page. */
export function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="h-14 px-4 flex items-center gap-4 border-b border-line">
        <Skeleton width={24} height={24} />
        <Skeleton width={120} height={20} />
      </div>
      <PageSkeleton />
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6" aria-busy="true" aria-label="Loading">
      <Skeleton width="50%" height={22} style={{ marginBottom: 16 }} />
      {[92, 80, 86, 60, 74].map((w, i) => <Skeleton key={i} width={`${w}%`} height={14} style={{ marginBottom: 10 }} />)}
      <Skeleton height={120} style={{ marginTop: 12 }} />
    </div>
  )
}
