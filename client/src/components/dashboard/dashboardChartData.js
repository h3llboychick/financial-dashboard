import { convertEntryAmount } from './dashboardUtils.js'

const DEFAULT_CHART_COLOR = '#6b7280'
const UNCATEGORIZED_KEY = 'uncategorized'

export const LEDGER_BREAKDOWN = 'ledger'

function roundValue(value) {
  return parseFloat(value.toFixed(2))
}

function ledgerRow(entry, ledgerMap) {
  const ledger = ledgerMap[entry.ledger_id]
  return {
    id: ledger?.id ?? entry.ledger_id ?? entry.ledger_name ?? 'unknown',
    name: ledger?.name || entry.ledger_name || 'Unknown',
    color: ledger?.color || DEFAULT_CHART_COLOR,
  }
}

function categoryRow(entry) {
  const categoryId = entry.category_id || UNCATEGORIZED_KEY
  return {
    id: categoryId,
    name: entry.category_name || 'Uncategorized',
    color: entry.category_color || DEFAULT_CHART_COLOR,
  }
}

function chartTitle(dimension, ledgerMap) {
  if (dimension === LEDGER_BREAKDOWN) return 'This Month by Ledger'
  const ledger = ledgerMap[dimension] || ledgerMap[Number(dimension)]
  return `This Month: ${ledger?.name || 'Unknown ledger'} by Category`
}

export function buildDonutData({
  monthEntries,
  dimension = LEDGER_BREAKDOWN,
  ledgerMap = {},
  currencyCode,
  exchangeRateState,
}) {
  const byCategory = dimension !== LEDGER_BREAKDOWN
  const rows = new Map()

  for (const entry of monthEntries) {
    if (byCategory && String(entry.ledger_id) !== String(dimension)) continue
    const row = byCategory ? categoryRow(entry) : ledgerRow(entry, ledgerMap)
    const existing = rows.get(row.id) || { ...row, value: 0 }
    existing.value += convertEntryAmount(entry, currencyCode, exchangeRateState)
    rows.set(row.id, existing)
  }

  return {
    title: chartTitle(dimension, ledgerMap),
    rows: [...rows.values()]
      .map(row => ({ ...row, value: roundValue(row.value) }))
      .sort((left, right) => right.value - left.value),
  }
}
