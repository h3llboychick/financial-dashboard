const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function pad(value) {
  return String(value).padStart(2, '0')
}

function daysInMonth(year, month) {
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return 29
  return MONTH_LENGTHS[month - 1]
}

/** Date of the rule inside one month, clamped to that month's last day. */
export function monthlyOccurrence({ dayOfMonth, year, month }) {
  const day = Math.min(dayOfMonth, daysInMonth(year, month))
  return `${year}-${pad(month)}-${pad(day)}`
}

function parseDate(value) {
  const [year, month] = String(value).split('-').map(Number)
  return { year, month }
}

/**
 * Occurrence dates that still need an entry: after the last generated date
 * (exclusive), not before the rule start date, not after today.
 */
export function dueOccurrences({ dayOfMonth, startDate, after = null, until, limit = 12 }) {
  if (!startDate || !until || startDate > until) return []

  const start = parseDate(startDate)
  const end = parseDate(until)
  const dates = []

  let year = start.year
  let month = start.month

  while (year * 12 + month <= end.year * 12 + end.month) {
    const occurrence = monthlyOccurrence({ dayOfMonth, year, month })
    const afterStart = occurrence >= startDate
    const alreadyDone = after !== null && occurrence <= after
    const arrived = occurrence <= until

    if (afterStart && arrived && !alreadyDone) {
      dates.push(occurrence)
      if (dates.length >= limit) break
    }

    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return dates
}
