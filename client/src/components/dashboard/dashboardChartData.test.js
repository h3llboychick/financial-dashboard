import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDonutData, LEDGER_BREAKDOWN } from './dashboardChartData.js'

const ledgers = [
  { id: 1, name: 'Spending', type: 'expense', color: '#ef4444' },
  { id: 2, name: 'Earnings', type: 'income', color: '#22c55e' },
]

const exchangeRateState = { target: 'EUR', rates: { EUR: 1 } }

function entry({ id, ledgerId, categoryId = null, categoryName = null, categoryColor = null, amount, currency = 'EUR' }) {
  return {
    id,
    ledger_id: ledgerId,
    category_id: categoryId,
    category_name: categoryName,
    category_color: categoryColor,
    amount,
    currency,
    date: '2026-06-10',
  }
}

function donut(monthEntries, overrides = {}) {
  return buildDonutData({
    monthEntries,
    dimension: LEDGER_BREAKDOWN,
    ledgerMap: Object.fromEntries(ledgers.map(ledger => [ledger.id, ledger])),
    currencyCode: 'EUR',
    exchangeRateState,
    ...overrides,
  })
}

test('breaks the month down by ledger by default', () => {
  const result = donut([
    entry({ id: 1, ledgerId: 1, categoryId: 10, amount: 40 }),
    entry({ id: 2, ledgerId: 1, categoryId: 11, amount: 60 }),
    entry({ id: 3, ledgerId: 2, categoryId: 20, amount: 200 }),
  ])

  assert.equal(result.title, 'This Month by Ledger')
  assert.deepEqual(result.rows, [
    { id: 2, name: 'Earnings', color: '#22c55e', value: 200 },
    { id: 1, name: 'Spending', color: '#ef4444', value: 100 },
  ])
})

test('breaks a single ledger down by category', () => {
  const result = donut([
    entry({ id: 1, ledgerId: 1, categoryId: 10, categoryName: 'Food', categoryColor: '#4ade80', amount: 30 }),
    entry({ id: 2, ledgerId: 1, categoryId: 10, categoryName: 'Food', categoryColor: '#4ade80', amount: 15 }),
    entry({ id: 3, ledgerId: 1, categoryId: 11, categoryName: 'Housing', categoryColor: '#60a5fa', amount: 500 }),
    entry({ id: 4, ledgerId: 2, categoryId: 20, categoryName: 'Salary', categoryColor: '#facc15', amount: 900 }),
  ], { dimension: 1 })

  assert.equal(result.title, 'This Month: Spending by Category')
  assert.deepEqual(result.rows, [
    { id: 11, name: 'Housing', color: '#60a5fa', value: 500 },
    { id: 10, name: 'Food', color: '#4ade80', value: 45 },
  ])
})

test('accepts a ledger id coming from a select element as a string', () => {
  const result = donut([
    entry({ id: 1, ledgerId: 1, categoryId: 10, categoryName: 'Food', amount: 30 }),
  ], { dimension: '1' })

  assert.equal(result.title, 'This Month: Spending by Category')
  assert.equal(result.rows.length, 1)
})

test('collects entries without a category under Uncategorized', () => {
  const result = donut([
    entry({ id: 1, ledgerId: 1, categoryId: null, amount: 25 }),
    entry({ id: 2, ledgerId: 1, categoryId: 10, categoryName: 'Food', categoryColor: '#4ade80', amount: 75 }),
  ], { dimension: 1 })

  assert.deepEqual(result.rows, [
    { id: 10, name: 'Food', color: '#4ade80', value: 75 },
    { id: 'uncategorized', name: 'Uncategorized', color: '#6b7280', value: 25 },
  ])
})

test('converts foreign currency entries into the display currency', () => {
  const result = donut([
    entry({ id: 1, ledgerId: 1, categoryId: 10, categoryName: 'Food', amount: 100, currency: 'USD' }),
    entry({ id: 2, ledgerId: 1, categoryId: 10, categoryName: 'Food', amount: 10 }),
  ], {
    dimension: 1,
    exchangeRateState: { target: 'EUR', rates: { EUR: 1, USD: 0.5 } },
  })

  assert.deepEqual(result.rows, [
    { id: 10, name: 'Food', color: '#6b7280', value: 60 },
  ])
})

test('returns no rows when the selected month has no entries', () => {
  const result = donut([])

  assert.equal(result.title, 'This Month by Ledger')
  assert.deepEqual(result.rows, [])
})

test('returns no rows when the selected ledger has no entries this month', () => {
  const result = donut([
    entry({ id: 1, ledgerId: 1, categoryId: 10, categoryName: 'Food', amount: 30 }),
  ], { dimension: 2 })

  assert.deepEqual(result.rows, [])
})
