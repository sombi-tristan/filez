/**
 * How well `text` answers what was typed: higher is better, -1 is no match. The typed words
 * found whole score best, earliest first; failing that, their letters in order, with a run of
 * neighbours scoring more than letters scattered about. Case does not matter.
 */
export function fuzzyScore(typed, text) {
  const q = String(typed || '').toLowerCase()
  const t = String(text || '').toLowerCase()
  if (!q) return 0
  const at = t.indexOf(q)
  if (at !== -1) return 1000 - at
  let from = 0
  let score = 0
  let streak = 0
  for (const letter of q) {
    const found = t.indexOf(letter, from)
    if (found === -1) return -1
    streak = found === from ? streak + 1 : 0
    score += 1 + streak
    from = found + 1
  }
  return score
}

/**
 * The options that answer what was typed, best first. An option is `{ value, label, sub }`; the
 * label and the sub line are both searched. With nothing typed they come back as given.
 */
export function fuzzyFilter(options, typed) {
  if (!typed) return options
  return options
    .map((option) => ({ option, score: Math.max(fuzzyScore(typed, option.label), fuzzyScore(typed, option.sub)) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.option)
}
