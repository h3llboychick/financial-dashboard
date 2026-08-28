import { convertEntryAmount, getYearMonth } from './dashboardUtils.js'

const PREVIOUS_MONTH_COUNT = 3

function entryType(entry, ledgerMap) {
  return entry.ledger_type || ledgerMap[entry.ledger_id]?.type
}

function entryDay(dateStr) {
  return Number(String(dateStr).slice(8, 10))
}

function periodEntries(entries, year, month, dayLimit = null) {
  return entries.filter(entry => {
    const period = getYearMonth(entry.date)
    if (period.year !== year || period.month !== month) return false
    return dayLimit === null || entryDay(entry.date) <= dayLimit
  })
}

function totalForType(rows, type, ledgerMap, currencyCode, exchangeRateState) {
  return rows.reduce((sum, entry) => {
    if (entryType(entry, ledgerMap) !== type) return sum
    return sum + convertEntryAmount(entry, currencyCode, exchangeRateState)
  }, 0)
}

function previousPeriods(entries, selectedYear, selectedMonth, dayLimit) {
  const periods = []
  for (let offset = 1; offset <= PREVIOUS_MONTH_COUNT; offset++) {
    const date = new Date(selectedYear, selectedMonth - 1 - offset, 1)
    const rows = periodEntries(entries, date.getFullYear(), date.getMonth() + 1, dayLimit)
    periods.push({ year: date.getFullYear(), month: date.getMonth() + 1, rows })
  }
  return periods
}

function average(values) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value, precision = 2) {
  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function buildDashboardAnalytics({
  entries,
  ledgers,
  categories,
  selectedYear,
  selectedMonth,
  currencyCode,
  exchangeRateState,
  now = new Date(),
}) {
  const ledgerMap = Object.fromEntries(ledgers.map(ledger => [ledger.id, ledger]))
  const categoryMap = Object.fromEntries(categories.map(category => [category.id, category]))
  const selectedIsCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1
  const dayLimit = selectedIsCurrentMonth ? now.getDate() : null
  const currentRows = periodEntries(entries, selectedYear, selectedMonth, dayLimit)
  const allPreviousPeriods = previousPeriods(entries, selectedYear, selectedMonth, dayLimit)
  const comparablePeriods = allPreviousPeriods.filter(period => period.rows.length > 0)

  if (currentRows.length === 0) {
    return { spending: null, category: null, investment: null }
  }

  const currentExpense = totalForType(currentRows, 'expense', ledgerMap, currencyCode, exchangeRateState)
  const expenseHistory = comparablePeriods.map(period =>
    totalForType(period.rows, 'expense', ledgerMap, currencyCode, exchangeRateState)
  )
  const expenseAverage = average(expenseHistory)
  const spendingChange = expenseAverage > 0
    ? (currentExpense - expenseAverage) / expenseAverage * 100
    : null
  const spendingTone = spendingChange === null
    ? 'neutral'
    : spendingChange >= 10
      ? 'attention'
      : spendingChange <= -5
        ? 'positive'
        : 'neutral'

  const spending = {
    current: round(currentExpense),
    average: expenseAverage === null ? null : round(expenseAverage),
    percentChange: spendingChange === null ? null : round(spendingChange, 1),
    monthsCompared: comparablePeriods.length,
    period: selectedIsCurrentMonth ? 'month to date' : 'month',
    tone: spendingTone,
  }

  const currentCategoryTotals = new Map()
  for (const entry of currentRows) {
    if (entryType(entry, ledgerMap) !== 'expense') continue
    const categoryId = entry.category_id || 0
    const current = currentCategoryTotals.get(categoryId) || {
      categoryId,
      name: entry.category_name || categoryMap[categoryId]?.name || 'Uncategorized',
      current: 0,
    }
    current.current += convertEntryAmount(entry, currencyCode, exchangeRateState)
    currentCategoryTotals.set(categoryId, current)
  }

  const categoryRows = [...currentCategoryTotals.values()].map(category => {
    const history = comparablePeriods.map(period => period.rows.reduce((sum, entry) => {
      if (entryType(entry, ledgerMap) !== 'expense' || (entry.category_id || 0) !== category.categoryId) return sum
      return sum + convertEntryAmount(entry, currencyCode, exchangeRateState)
    }, 0))
    const historyAverage = average(history)
    const percentChange = historyAverage > 0
      ? (category.current - historyAverage) / historyAverage * 100
      : null
    return {
      ...category,
      current: round(category.current),
      share: currentExpense > 0 ? round(category.current / currentExpense * 100, 1) : 0,
      average: historyAverage === null ? null : round(historyAverage),
      percentChange: percentChange === null ? null : round(percentChange, 1),
    }
  }).sort((left, right) => right.current - left.current)

  const spike = categoryRows
    .filter(category => category.share >= 5 && category.percentChange >= 20)
    .sort((left, right) => right.percentChange - left.percentChange || right.current - left.current)[0]
  const selectedCategory = spike || categoryRows[0] || null
  const category = selectedCategory
    ? {
        ...selectedCategory,
        kind: spike ? 'spike' : 'largest',
        tone: spike ? 'attention' : 'neutral',
        monthsCompared: comparablePeriods.length,
      }
    : null

  const currentIncome = totalForType(currentRows, 'income', ledgerMap, currencyCode, exchangeRateState)
  const currentInvestment = totalForType(currentRows, 'investment', ledgerMap, currencyCode, exchangeRateState)
  const investmentRate = currentIncome > 0 ? currentInvestment / currentIncome * 100 : null
  const lastPeriod = allPreviousPeriods[0]
  const lastIncome = lastPeriod
    ? totalForType(lastPeriod.rows, 'income', ledgerMap, currencyCode, exchangeRateState)
    : 0
  const lastInvestment = lastPeriod
    ? totalForType(lastPeriod.rows, 'investment', ledgerMap, currencyCode, exchangeRateState)
    : 0
  const lastRate = lastIncome > 0 ? lastInvestment / lastIncome * 100 : null
  const rateChange = investmentRate !== null && lastRate !== null ? investmentRate - lastRate : null
  const investmentTone = rateChange === null
    ? 'neutral'
    : rateChange >= 1
      ? 'positive'
      : rateChange <= -1
        ? 'attention'
        : 'neutral'
  const investment = investmentRate === null
    ? null
    : {
        invested: round(currentInvestment),
        income: round(currentIncome),
        rate: round(investmentRate, 1),
        lastRate: lastRate === null ? null : round(lastRate, 1),
        percentagePointChange: rateChange === null ? null : round(rateChange, 1),
        tone: investmentTone,
      }

  return { spending, category, investment }
}
