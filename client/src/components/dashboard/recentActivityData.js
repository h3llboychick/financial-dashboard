import { getYearMonth } from './dashboardUtils.js'

export const RECENT_ACTIVITY_LIMIT = 6

function compareDescending(left, right) {
  const dateComparison = String(right.date || '').localeCompare(String(left.date || ''))
  if (dateComparison !== 0) return dateComparison

  const createdComparison = String(right.created_at || '').localeCompare(String(left.created_at || ''))
  if (createdComparison !== 0) return createdComparison

  return Number(right.id || 0) - Number(left.id || 0)
}

export function getRecentActivity(entries, selectedYear, selectedMonth, limit = RECENT_ACTIVITY_LIMIT) {
  return entries
    .filter(entry => {
      const period = getYearMonth(entry.date)
      return period.year === selectedYear && period.month === selectedMonth
    })
    .sort(compareDescending)
    .slice(0, Math.max(0, limit))
}
