function getEntryCurrency(entry) {
  return entry.currency || 'EUR'
}

function typeLabel(type) {
  if (type === 'income') return 'Income'
  if (type === 'investment') return 'Investment'
  return 'Expense'
}

function getYearMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function convertEntryAmount (entry, currencyCode, exchangeRateState) {
  const entryCurrency = getEntryCurrency(entry)
  if (entryCurrency === currencyCode) return entry.amount
  if (exchangeRateState.target !== currencyCode) return 0

  const rate = exchangeRateState.rates[entryCurrency]
  return Number.isFinite(rate) ? entry.amount * rate : 0
}

function totalsFor(rows, ledgerMap, currencyCode, exchangeRateState) {
  return rows.reduce((sum, entry) => {
    const type = entry.ledger_type || ledgerMap[entry.ledger_id]?.type
    const convertedAmount = convertEntryAmount(entry, currencyCode, exchangeRateState)
    if (type === 'income') sum.income += convertedAmount
    else if (type === 'investment') sum.investment += convertedAmount
    else sum.expense += convertedAmount
    return sum
  }, { income: 0, expense: 0, investment: 0 })
}



export { getEntryCurrency, typeLabel, getYearMonth, convertEntryAmount, totalsFor }
