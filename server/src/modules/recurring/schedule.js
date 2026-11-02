const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MAX_CANDIDATES = 600

function pad(value) {
  return String(value).padStart(2, '0')
}

function daysInMonth(year, month) {
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return 29
  return MONTH_LENGTHS[month - 1]
}

function toDate(value) {
  const [year, month, day] = String(value).split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function toIso(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000)
}

/**
 * Date of the rule inside one month. With lastDay the rule always lands on the
 * final day of the month, otherwise the day is clamped to it.
 */
export function monthlyOccurrence({ dayOfMonth, lastDay = false, year, month }) {
  const monthLength = daysInMonth(year, month)
  const day = lastDay ? monthLength : Math.min(dayOfMonth, monthLength)
  return `${year}-${pad(month)}-${pad(day)}`
}

function isLastDay(rule) {
  return rule.last_day === true || rule.last_day === 1
}

function intervalOf(rule) {
  return Math.max(1, Number(rule.interval_count) || 1)
}

/**
 * Walks the rule's own calendar forward. Every frequency steps by its interval
 * from the rule's start date, so "every 2 months" stays anchored to the month
 * the rule was created in and does not drift with today's date.
 */
function* candidates(rule) {
  const start = toDate(rule.start_date)
  const interval = intervalOf(rule)

  if (rule.frequency === 'daily') {
    let date = start
    for (let index = 0; index < MAX_CANDIDATES; index += 1) {
      yield toIso(date)
      date = addDays(date, interval)
    }
    return
  }

  if (rule.frequency === 'weekly') {
    const weekday = Number(rule.weekday)
    let weekStart = addDays(start, -start.getUTCDay())
    for (let index = 0; index < MAX_CANDIDATES; index += 1) {
      yield toIso(addDays(weekStart, weekday))
      weekStart = addDays(weekStart, 7 * interval)
    }
    return
  }

  if (rule.frequency === 'yearly') {
    const month = Number(rule.month_of_year) || start.getUTCMonth() + 1
    let year = start.getUTCFullYear()
    for (let index = 0; index < MAX_CANDIDATES; index += 1) {
      yield monthlyOccurrence({ dayOfMonth: rule.day_of_month, lastDay: isLastDay(rule), year, month })
      year += interval
    }
    return
  }

  let year = start.getUTCFullYear()
  let month = start.getUTCMonth() + 1
  for (let index = 0; index < MAX_CANDIDATES; index += 1) {
    yield monthlyOccurrence({ dayOfMonth: rule.day_of_month, lastDay: isLastDay(rule), year, month })
    month += interval
    while (month > 12) {
      month -= 12
      year += 1
    }
  }
}

/**
 * Occurrence dates that still need an entry: after the last generated date
 * (exclusive), not before the rule start date, not after today.
 */
export function dueOccurrences({ rule, after = null, until, limit = 12 }) {
  if (!rule?.start_date || !until || rule.start_date > until) return []

  const dates = []
  for (const candidate of candidates(rule)) {
    if (candidate > until) break
    if (rule.end_date && candidate > rule.end_date) break
    if (candidate < rule.start_date) continue
    if (after !== null && candidate <= after) continue
    dates.push(candidate)
    if (dates.length >= limit) break
  }
  return dates
}

/** First occurrence strictly after a given date, used to show what comes next. */
export function nextOccurrenceAfter(rule, after) {
  if (!rule?.start_date) return null
  const [next] = dueOccurrences({ rule, after, until: '9999-12-31', limit: 1 })
  return next ?? null
}

/** Human wording for the rule, shared by the API response and the UI. */
export function scheduleLabel(rule) {
  const interval = intervalOf(rule)
  const lastDay = isLastDay(rule)
  const dayOfMonth = Number(rule.day_of_month)

  if (rule.frequency === 'daily') {
    return interval === 1 ? 'Every day' : `Every ${interval} days`
  }

  if (rule.frequency === 'weekly') {
    const weekday = WEEKDAY_NAMES[Number(rule.weekday)] ?? 'day'
    return interval === 1 ? `Every ${weekday}` : `Every ${interval} weeks on ${weekday}`
  }

  if (rule.frequency === 'yearly') {
    const month = MONTH_NAMES[(Number(rule.month_of_year) || 1) - 1]
    const day = lastDay ? 'the last day' : `day ${dayOfMonth}`
    return interval === 1
      ? `Every year on ${day} of ${month}`
      : `Every ${interval} years on ${day} of ${month}`
  }

  const day = lastDay ? 'the last day' : `day ${dayOfMonth}`
  return interval === 1 ? `Monthly on ${day}` : `Every ${interval} months on ${day}`
}
