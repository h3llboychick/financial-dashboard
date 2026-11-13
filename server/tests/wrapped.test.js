import { afterAll, describe, expect, test } from '@jest/globals'
import { buildWrapped } from '../src/modules/wrapped/wrapped.service.js'

const ledgers = [
  { id: 1, name: 'Spending', type: 'expense', color: '#ef4444' },
  { id: 2, name: 'Earnings', type: 'income', color: '#22c55e' },
  { id: 3, name: 'Investments', type: 'investment', color: '#3b82f6' },
]

const categories = [
  { id: 10, ledger_id: 1, name: 'Housing', color: '#eab308' },
  { id: 11, ledger_id: 1, name: 'Food', color: '#ef4444' },
  { id: 12, ledger_id: 2, name: 'Salary', color: '#22c55e' },
]

function entry({ id, date, amount, ledger = 1, category = 10, currency = 'EUR', created = `${date} 21:15:00` }) {
  return {
    id,
    ledger_id: ledger,
    ledger_type: ledgers.find(l => l.id === ledger).type,
    category_id: category,
    amount,
    currency,
    date,
    note: '',
    created_at: created,
    wallet_id: 1,
  }
}

const entries = [
  entry({ id: 1, date: '2026-01-05', amount: 1200, ledger: 2, category: 12 }),
  entry({ id: 2, date: '2026-01-10', amount: 400, category: 10 }),
  entry({ id: 3, date: '2026-01-10', amount: 60, category: 11 }),
  entry({ id: 4, date: '2026-02-01', amount: 300, category: 10 }),
  entry({ id: 5, date: '2026-02-02', amount: 100, category: 11 }),
  entry({ id: 6, date: '2026-02-03', amount: 900, ledger: 2, category: 12 }),
  entry({ id: 7, date: '2026-03-15', amount: 800, ledger: 3, category: 10 }),
  entry({ id: 8, date: '2026-03-20', amount: 200, category: 11, created: '2026-03-20 23:40:00' }),
  entry({ id: 9, date: '2026-03-21', amount: 100, category: 11 }),
  entry({ id: 10, date: '2026-05-05', amount: 50, category: 11, currency: 'USD' }),
  entry({ id: 11, date: '2025-12-31', amount: 500, category: 10 }),
]

function wrapped(overrides = {}) {
  return buildWrapped({
    year: 2026,
    entries,
    ledgers,
    categories,
    transfers: [{ id: 1 }, { id: 2 }],
    rules: [
      { id: 1, active: 1, amount: 30, currency: 'EUR' },
      { id: 2, active: 1, amount: 44, currency: 'EUR' },
      { id: 3, active: 0, amount: 12, currency: 'EUR' },
    ],
    ...overrides,
  })
}

describe('buildWrapped', () => {
  test('counts only the requested year and the dominant currency', () => {
    const result = wrapped()

    expect(result.year).toBe(2026)
    expect(result.currency).toBe('EUR')
    expect(result.entries_counted).toBe(9)
    expect(result.skipped_other_currency).toBe(1)
  })

  test('sums income, spending and investments', () => {
    const result = wrapped()

    expect(result.totals).toEqual({ earned: 2100, spent: 1160, invested: 800, net: 140, entries: 9 })
  })

  test('splits months and finds the longest positive streak', () => {
    const result = wrapped()

    expect(result.months.map(m => m.month)).toEqual([1, 2, 3])
    expect(result.months[0]).toMatchObject({ month: 1, net: 740 })
    expect(result.months_positive).toBe(2)
    expect(result.months_negative).toBe(1)
    expect(result.longest_positive_streak).toBe(2)
  })

  test('ranks categories by spending and computes shares', () => {
    const result = wrapped()

    expect(result.categories[0]).toMatchObject({ name: 'Housing', amount: 700, color: '#eab308' })
    expect(result.categories[0].share).toBeCloseTo(60.3, 1)
    expect(result.categories[1]).toMatchObject({ name: 'Food', amount: 460 })
  })

  test('finds the most expensive day and the biggest single expense', () => {
    const result = wrapped()

    expect(result.biggest_day).toEqual({ date: '2026-01-10', amount: 460, entries: 2 })
    expect(result.biggest_entry).toMatchObject({ date: '2026-01-10', amount: 400, category: 'Housing' })
  })

  test('counts days without spending and the longest run', () => {
    const result = wrapped()

    expect(result.no_spend_days).toBe(360)
    expect(result.longest_no_spend_streak.days).toBe(285)
    expect(result.longest_no_spend_streak.from).toBe('2026-03-22')
    expect(result.longest_no_spend_streak.to).toBe('2026-12-31')
  })

  test('compares the average and median spending day', () => {
    const result = wrapped()

    // дни с тратами: 400+60=460, 300, 100, 200, 100
    expect(result.spend_day_mean).toBe(232)
    expect(result.spend_day_median).toBe(200)
  })

  test('groups spending by weekday', () => {
    const result = wrapped()
    const monday = result.weekdays.find(day => day.index === 1)

    // 2026-01-05 понедельник: 1200 дохода, трат нет; 2026-03-15 тоже понедельник
    expect(monday.label).toBe('Mon')
    expect(result.weekdays).toHaveLength(7)
  })

  test('reports subscriptions and transfers', () => {
    const result = wrapped()

    expect(result.subscriptions).toEqual({ active_rules: 2, monthly_amount: 74 })
    expect(result.transfers_count).toBe(2)
  })

  test('reads the logging time from created_at', () => {
    const result = wrapped()

    expect(result.logging.share_after_22).toBeCloseTo(11.1, 1)
    expect(result.logging.median_hour).toBe(21)
  })

  test('returns an empty shape when the year has no entries', () => {
    const result = buildWrapped({ year: 2024, entries, ledgers, categories, transfers: [], rules: [] })

    expect(result.totals).toEqual({ earned: 0, spent: 0, invested: 0, net: 0, entries: 0 })
    expect(result.months).toEqual([])
    expect(result.categories).toEqual([])
    expect(result.biggest_day).toBeNull()
    expect(result.has_data).toBe(false)
  })

  test('marks a year with data', () => {
    expect(wrapped().has_data).toBe(true)
  })
})
