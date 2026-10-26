/**
 * Pasted POS lines → lodgement entries. Bedbug reads the banks' end-of-day POS slips and copies
 * one line per amount: date, POS or TRANSFER, terminal ID, amount. Each line finds its account by
 * terminal ID and type; the date is the sales date. A line with no account (or two) is left over
 * with the reason, never guessed.
 */

const LINE = /^(\d{4}-\d{2}-\d{2})\s+(POS|TRANSFER)\s+(\S+)\s+([\d,]+(?:\.\d+)?)$/i

// A phone reading a thermal print can take 0 for O and 1 for I or L, so those count as the same.
const terminalKey = (t) => String(t || '').trim().toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')

const realDay = (d) => {
  const t = new Date(`${d}T00:00:00Z`)
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d
}

export function readPosLines(text, banks) {
  const entries = []
  const problems = []
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = LINE.exec(line)
    if (!m || !realDay(m[1])) {
      problems.push({ line, reason: 'Not a POS line (date, POS or TRANSFER, terminal, amount)' })
      continue
    }
    const type = m[2].toLowerCase()
    const word = type === 'pos' ? 'POS' : 'transfer'
    const terminal = m[3].toUpperCase()
    const matches = banks.filter((b) => b.lodgement_type === type && b.terminal_id && terminalKey(b.terminal_id) === terminalKey(terminal))
    if (matches.length !== 1) {
      problems.push({ line, reason: matches.length ? `${matches.length} ${word} accounts have terminal ${terminal}; pick the account by hand` : `No ${word} account with terminal ${terminal}` })
      continue
    }
    entries.push({ bankId: matches[0].id, lodgementType: type, amount: Number(m[4].replace(/,/g, '')).toFixed(2), salesDate: m[1] })
  }
  return { entries, problems }
}
