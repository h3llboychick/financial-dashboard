const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function daysInMonth(year, month) {
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return 29
  return MONTH_LENGTHS[month - 1]
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** When the rule fires next, using the same clamping the server applies. */
export function nextOccurrence({ dayOfMonth, today = new Date() }) {
  const day = Number(dayOfMonth)
  if (!Number.isInteger(day) || day < 1 || day > 31) return null

  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const clampedThisMonth = Math.min(day, daysInMonth(year, month))

  if (clampedThisMonth >= today.getDate()) {
    return { date: isoDate(year, month, clampedThisMonth), monthName: MONTH_NAMES[month - 1] }
  }

  let nextYear = year
  let nextMonth = month + 1
  if (nextMonth > 12) {
    nextMonth = 1
    nextYear += 1
  }
  const clampedNextMonth = Math.min(day, daysInMonth(nextYear, nextMonth))
  return { date: isoDate(nextYear, nextMonth, clampedNextMonth), monthName: MONTH_NAMES[nextMonth - 1] }
}
