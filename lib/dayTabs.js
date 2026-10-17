/**
 * Where a report's strip of tabs starts so the one shown is in view: the Daily Sales Report's
 * days and Sales Operation's sheets, `count` tabs at a time. Pinned by tests/day-tabs.test.mjs.
 *
 *   index   the shown tab's place in the report, or -1 when it is not in it (a new range was
 *           generated and the day shown is about to move into it)
 *   offset  where the strip starts now
 *
 * Never before the first tab: a start of -1 showed only the last tab, as if the report held one
 * date, with the back arrow disabled.
 */
export function tabOffsetFor({ index, offset, count }) {
  const start = Math.max(0, offset)
  if (index < 0) return start
  if (index < start) return index
  if (index >= start + count) return index - count + 1
  return start
}
