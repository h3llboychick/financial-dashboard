import { useMemo } from 'react'
import { MONTHS_SHORT } from '../../constants.js'
import { getYearMonth, convertEntryAmount, totalsFor } from './dashboardUtils.js'

const DEFAULT_CHART_COLOR = '#6b7280'

export const useDashboardData = ({ entries, ledgers, categories, selectedYear, selectedMonth, currencyCode, exchangeRateState, breakdownLedgerId }) => {
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
  const categoryColorMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c.color])),
    [categories]
  )
  const categoryNameMap = useMemo(
    () => Object.fromEntries(categories.map(c => [c.id, c.name])),
    [categories]
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

  const ledgerPieData = useMemo(() => {
    const map = {}
    monthEntries.forEach(entry => {
      const ledger = ledgerMap[entry.ledger_id]
      const key = ledger?.id ?? entry.ledger_id ?? entry.ledger_name ?? 'unknown'
      const name = ledger?.name || entry.ledger_name || 'Unknown'
      if (!map[key]) {
        map[key] = {
          id: key,
          name,
          color: ledger?.color || DEFAULT_CHART_COLOR,
          value: 0,
        }
      }
      map[key].value += convertEntryAmount(entry, currencyCode, exchangeRateState)
    })
    return Object.values(map)
      .map(row => ({ ...row, value: parseFloat(row.value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [monthEntries, ledgerMap, exchangeRateState, currencyCode])

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

  const ledgerBreakdown = useMemo(() =>
    ledgers.map(ledger => {
      const total = monthEntries
        .filter(entry => entry.ledger_id === ledger.id)
        .reduce((sum, entry) => sum + convertEntryAmount(entry, currencyCode, exchangeRateState), 0)
      return { ...ledger, total: parseFloat(total.toFixed(2)) }
    }).filter(row => row.total > 0),
    [ledgers, monthEntries, exchangeRateState, currencyCode]
  )

  const categoryData = useMemo(() => {
    const map = {}
    monthEntries
      .filter(entry => entry.ledger_id === Number(breakdownLedgerId))
      .forEach(entry => {
        const category_id = entry.category_id || 0
        const category_name = entry.category_name || categoryNameMap[category_id] || 'Uncategorized'
        if (!map[category_id]) {
          map[category_id] = {
            category_id,
            name: category_name,
            color: categoryColorMap[category_id] || DEFAULT_CHART_COLOR,
            value: 0,
          }
        }
        map[category_id].value += convertEntryAmount(entry, currencyCode, exchangeRateState)
      })
    return Object.values(map)
      .map(row => ({ ...row, value: parseFloat(row.value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
  }, [monthEntries, breakdownLedgerId, exchangeRateState, currencyCode, categoryNameMap, categoryColorMap])

  const categoryTotal = categoryData.reduce((sum, row) => sum + row.value, 0)
    
  return {
    filters: { years },
    summary: { totals, net, netChange },
    charts: { barData, ledgerPieData, categoryData },
    breakdowns: { ledgerBreakdown, categoryTotal },
  }
}
