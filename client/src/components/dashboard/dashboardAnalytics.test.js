import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDashboardAnalytics } from './dashboardAnalytics.js'

const ledgers = [
  { id: 1, name: 'Spending', type: 'expense' },
  { id: 2, name: 'Earnings', type: 'income' },
  { id: 3, name: 'Investments', type: 'investment' },
]

const categories = [
  { id: 1, ledger_id: 1, name: 'Food & Dining' },
  { id: 2, ledger_id: 1, name: 'Housing' },
]

const exchangeRateState = { target: 'EUR', rates: { EUR: 1 } }

function entry({ id, ledgerId, categoryId = null, amount, date, categoryName = null }) {
  return {
    id,
    ledger_id: ledgerId,
    category_id: categoryId,
    category_name: categoryName,
    amount,
    currency: 'EUR',
    date,
  }
}

function analytics(entries, overrides = {}) {
  return buildDashboardAnalytics({
    entries,
    ledgers,
    categories,
    selectedYear: 2026,
    selectedMonth: 6,
    currencyCode: 'EUR',
    exchangeRateState,
    now: new Date('2026-08-28T12:00:00Z'),
    ...overrides,
  })
}

test('compares spending with the average of previous months that contain data', () => {
  const result = analytics([
    entry({ id: 1, ledgerId: 1, categoryId: 1, amount: 120, date: '2026-06-10' }),
    entry({ id: 2, ledgerId: 1, categoryId: 1, amount: 100, date: '2026-05-10' }),
    entry({ id: 3, ledgerId: 1, categoryId: 1, amount: 80, date: '2026-04-10' }),
  ])

  assert.deepEqual(result.spending, {
    current: 120,
    average: 90,
    percentChange: 33.3,
    monthsCompared: 2,
    period: 'month',
    tone: 'attention',
  })
})

test('selects a meaningful category spike over the largest stable category', () => {
  const result = analytics([
    entry({ id: 1, ledgerId: 1, categoryId: 1, categoryName: 'Food & Dining', amount: 80, date: '2026-06-10' }),
    entry({ id: 2, ledgerId: 1, categoryId: 2, categoryName: 'Housing', amount: 120, date: '2026-06-10' }),
    entry({ id: 3, ledgerId: 1, categoryId: 1, amount: 20, date: '2026-05-10' }),
    entry({ id: 4, ledgerId: 1, categoryId: 2, amount: 120, date: '2026-05-10' }),
    entry({ id: 5, ledgerId: 1, categoryId: 1, amount: 20, date: '2026-04-10' }),
    entry({ id: 6, ledgerId: 1, categoryId: 2, amount: 120, date: '2026-04-10' }),
  ])

  assert.equal(result.category.name, 'Food & Dining')
  assert.equal(result.category.kind, 'spike')
  assert.equal(result.category.current, 80)
  assert.equal(result.category.average, 20)
  assert.equal(result.category.percentChange, 300)
  assert.equal(result.category.share, 40)
  assert.equal(result.category.tone, 'attention')
})

test('calculates investment rate and percentage-point change from last month', () => {
  const result = analytics([
    entry({ id: 1, ledgerId: 2, amount: 1000, date: '2026-06-01' }),
    entry({ id: 2, ledgerId: 3, amount: 200, date: '2026-06-15' }),
    entry({ id: 3, ledgerId: 2, amount: 1000, date: '2026-05-01' }),
    entry({ id: 4, ledgerId: 3, amount: 100, date: '2026-05-15' }),
  ])

  assert.deepEqual(result.investment, {
    invested: 200,
    income: 1000,
    rate: 20,
    lastRate: 10,
    percentagePointChange: 10,
    tone: 'positive',
  })
})

test('uses the same day cutoff for the current month and comparison months', () => {
  const result = analytics([
    entry({ id: 1, ledgerId: 1, categoryId: 1, amount: 100, date: '2026-08-10' }),
    entry({ id: 2, ledgerId: 1, categoryId: 1, amount: 900, date: '2026-08-20' }),
    entry({ id: 3, ledgerId: 1, categoryId: 1, amount: 80, date: '2026-07-10' }),
    entry({ id: 4, ledgerId: 1, categoryId: 1, amount: 720, date: '2026-07-20' }),
  ], {
    selectedYear: 2026,
    selectedMonth: 8,
    now: new Date('2026-08-15T12:00:00Z'),
  })

  assert.equal(result.spending.current, 100)
  assert.equal(result.spending.average, 80)
  assert.equal(result.spending.percentChange, 25)
  assert.equal(result.spending.period, 'month to date')
})

test('returns no insights when the selected period has no entries', () => {
  assert.deepEqual(analytics([]), { spending: null, category: null, investment: null })
})
