/**
 * Paging for any list that can run long. Pages count from 0. A page asked for past the end (the
 * list got shorter while page 4 was open) is the last page, never an empty one.
 */
export const PAGE_SIZE = 12

export function pageCount(total, size = PAGE_SIZE) {
  if (!size || size <= 0) return 1
  return Math.max(1, Math.ceil((total || 0) / size))
}

/** `{ page, count, offset, rows }` for the page asked for, held inside what exists. */
export function pageOf(rows, page = 0, size = PAGE_SIZE) {
  const list = rows || []
  const count = pageCount(list.length, size)
  const at = Math.min(Math.max(0, page), count - 1)
  if (!size || size <= 0) return { page: 0, count: 1, offset: 0, rows: list }
  const offset = at * size
  return { page: at, count, offset, rows: list.slice(offset, offset + size) }
}
