export const PRESETS = [
  { id: 'last_day', label: 'Last day of month' },
  { id: 'month_day', label: 'Day of month' },
  { id: 'every_n_months', label: 'Every N months' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'every_n_days', label: 'Every N days' },
  { id: 'yearly', label: 'Yearly' },
]

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

/**
 * Turns the form's preset and the fields that belong to it into the schedule
 * part of a recurring rule. Kept pure so the mapping can be tested without
 * rendering the form.
 */
export function buildSchedule({ preset, day = 1, weekday = 1, interval = 1, month = 1 }) {
  const dayOfMonth = clampInteger(day, 1, 31, 1)
  const every = clampInteger(interval, 1, 365, 1)
  const dayOfWeek = clampInteger(weekday, 0, 6, 1)
  const monthOfYear = clampInteger(month, 1, 12, 1)

  switch (preset) {
    case 'last_day':
      return { frequency: 'monthly', interval_count: 1, day_of_month: 31, last_day: true }
    case 'month_day':
      return { frequency: 'monthly', interval_count: 1, day_of_month: dayOfMonth, last_day: false }
    case 'every_n_months':
      return { frequency: 'monthly', interval_count: every, day_of_month: dayOfMonth, last_day: false }
    case 'weekly':
      return { frequency: 'weekly', interval_count: every, weekday: dayOfWeek }
    case 'every_n_days':
      return { frequency: 'daily', interval_count: every }
    case 'yearly':
      return {
        frequency: 'yearly',
        interval_count: 1,
        month_of_year: monthOfYear,
        day_of_month: dayOfMonth,
        last_day: false,
      }
    default:
      throw new Error(`Unknown preset: ${preset}`)
  }
}

/**
 * Rebuilds the form state from a stored rule, so the same form can edit it.
 */
export function scheduleFormFromRule(rule) {
  const frequency = rule?.frequency || 'monthly'
  const interval = Number(rule?.interval_count) || 1
  const day = String(rule?.day_of_month ?? 1)
  const weekday = String(rule?.weekday ?? 1)
  const month = String(rule?.month_of_year ?? 1)
  const lastDay = rule?.last_day === 1 || rule?.last_day === true

  if (frequency === 'daily') return { preset: 'every_n_days', interval, day, weekday, month }
  if (frequency === 'weekly') return { preset: 'weekly', interval, day, weekday, month }
  if (frequency === 'yearly') return { preset: 'yearly', interval, day, weekday, month }

  if (interval > 1) return { preset: 'every_n_months', interval, day, weekday, month }
  return { preset: lastDay ? 'last_day' : 'month_day', interval, day, weekday, month }
}
