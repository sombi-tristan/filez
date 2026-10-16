/**
 * A placeholder block while a screen loads, sized by the caller: a quiet pulse in the line
 * colour, still for anyone who asked for less motion. A screen draws these in the shape of what
 * is coming, never a spinner in the middle of nothing. Dressed by `.house-skeleton`.
 *
 *   width, height  numbers are pixels; a string is taken as written ('60%')
 *   round          a circle, for where a face will be
 */
export default function Skeleton({ width, height = 20, round = false, className = '', style }) {
  return (
    <div
      aria-hidden="true"
      className={`house-skeleton ${round ? 'house-skeleton-round' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={{ width, height, ...style }}
    />
  )
}

/** The shape of a ListRow: an icon, a label, and a value at the end unless `value` is false. */
export function ListRowSkeleton({ value = true }) {
  return (
    <div className="house-skeleton-row">
      <Skeleton width={24} height={24} />
      <Skeleton width="38%" />
      {value ? <Skeleton width={48} style={{ marginLeft: 'auto' }} /> : null}
    </div>
  )
}

/** Lines of text; `lines` is each line's width as a percentage. */
export function TextSkeleton({ lines = [60, 92, 78], className = '' }) {
  return (
    <div className={className} aria-hidden="true">
      {lines.map((w, i) => (
        <Skeleton key={i} width={`${w}%`} style={{ marginTop: i === 0 ? 0 : 8 }} />
      ))}
    </div>
  )
}
