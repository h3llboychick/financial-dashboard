import { useMemo } from 'react'
import { MONTHS_SHORT } from '../../constants.js'
import { buildDashboardAnalytics } from './dashboardAnalytics.js'
import { buildDonutData, LEDGER_BREAKDOWN } from './dashboardChartData.js'
import { getYearMonth, convertEntryAmount, totalsFor } from './dashboardUtils.js'

export const useDashboardData = ({ entries, ledgers, categories, selectedYear, selectedMonth, currencyCode, exchangeRateState, donutDimension = LEDGER_BREAKDOWN }) => {
  const currentYear = new Date().getFullYear()
  const years = useMemo(() => {
    const ys = new Set(entries.map(entry => getYearMonth(entry.date).year))
    ys.add(currentYear)
    return Array.from(ys).sort((a, b) => b - a)
  }, [entries, currentYear])

  const ledgerMap = useMemo(
    () => Object.fromEntries(ledgers.map(l => [l.id, l])),
    [ledgers]
  )
  const monthEntries = useMemo(() =>
    entries.filter(entry => {
      const { year, month } = getYearMonth(entry.date)
      return year === selectedYear && month === selectedMonth
    }),
    [entries, selectedYear, selectedMonth]
  )

  const lastMonthEntries = useMemo(() => {
    let lastMonth = selectedMonth - 1
    let lastYear = selectedYear
    if (lastMonth === 0) {
      lastMonth = 12
      lastYear--
    }
    return entries.filter(entry => {
      const { year, month } = getYearMonth(entry.date)
      return year === lastYear && month === lastMonth
    })
  }, [entries, selectedYear, selectedMonth])

  const totals = totalsFor(monthEntries, ledgerMap, currencyCode, exchangeRateState)
  const lastTotals = totalsFor(lastMonthEntries, ledgerMap, currencyCode, exchangeRateState)
  const net = totals.income - totals.expense - totals.investment
  const lastNet = lastTotals.income - lastTotals.expense - lastTotals.investment
  const netChange = lastNet === 0 ? null : (net - lastNet) / Math.abs(lastNet) * 100

  const donut = useMemo(() => buildDonutData({
    monthEntries,
    dimension: donutDimension,
    ledgerMap,
    currencyCode,
    exchangeRateState,
  }), [monthEntries, donutDimension, ledgerMap, exchangeRateState, currencyCode])

  const barData = useMemo(() => {
    const result = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1)
      const row = {
        month: MONTHS_SHORT[d.getMonth()],
        Earned: 0,
        Spent: 0,
        Invested: 0,
      }
      entries.forEach(entry => {
        const { year, month } = getYearMonth(entry.date)
        if (year !== d.getFullYear() || month !== d.getMonth() + 1) return
        const type = entry.ledger_type || ledgerMap[entry.ledger_id]?.type
        const convertedAmount = convertEntryAmount(entry, currencyCode, exchangeRateState)
        if (type === 'income') row.Earned += convertedAmount
        else if (type === 'investment') row.Invested += convertedAmount
        else row.Spent += convertedAmount
      })
      row.Earned = parseFloat(row.Earned.toFixed(2))
      row.Spent = parseFloat(row.Spent.toFixed(2))
      row.Invested = parseFloat(row.Invested.toFixed(2))
      result.push(row)
    }
    return result
  }, [entries, ledgerMap, selectedYear, selectedMonth, exchangeRateState, currencyCode])

  const analytics = useMemo(() => buildDashboardAnalytics({
    entries,
    ledgers,
    categories,
    selectedYear,
    selectedMonth,
    currencyCode,
    exchangeRateState,
  }), [entries, ledgers, categories, selectedYear, selectedMonth, currencyCode, exchangeRateState])
    
  return {
    filters: { years },
    summary: { totals, net, netChange },
    charts: { barData, donut },
    analytics,
  }
}
