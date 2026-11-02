import { describe, expect, test } from '@jest/globals'
import { dueOccurrences, monthlyOccurrence } from '../src/modules/recurring/schedule.js'

describe('monthlyOccurrence', () => {
  test('clamps the day to the length of the month', () => {
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2026, month: 2 })).toBe('2026-02-28')
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2028, month: 2 })).toBe('2028-02-29')
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2026, month: 4 })).toBe('2026-04-30')
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2026, month: 1 })).toBe('2026-01-31')
  })
})

describe('dueOccurrences', () => {
  test('returns one occurrence per month between the start date and today', () => {
    const dates = dueOccurrences({
      dayOfMonth: 31,
      startDate: '2026-01-15',
      until: '2026-04-30',
    })

    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  test('skips occurrences before the start date', () => {
    const dates = dueOccurrences({
      dayOfMonth: 5,
      startDate: '2026-03-20',
      until: '2026-05-31',
    })

    expect(dates).toEqual(['2026-04-05', '2026-05-05'])
  })

  test('skips occurrences already generated', () => {
    const dates = dueOccurrences({
      dayOfMonth: 5,
      startDate: '2026-01-01',
      after: '2026-04-05',
      until: '2026-06-30',
    })

    expect(dates).toEqual(['2026-05-05', '2026-06-05'])
  })

  test('returns nothing before this month occurrence has arrived', () => {
    const dates = dueOccurrences({
      dayOfMonth: 28,
      startDate: '2026-01-01',
      after: '2026-05-28',
      until: '2026-06-27',
    })

    expect(dates).toEqual([])
  })

  test('caps how many missed occurrences it backfills', () => {
    const dates = dueOccurrences({
      dayOfMonth: 1,
      startDate: '2024-01-01',
      until: '2026-06-01',
      limit: 3,
    })

    expect(dates).toEqual(['2024-01-01', '2024-02-01', '2024-03-01'])
  })

  test('walks across a year boundary', () => {
    const dates = dueOccurrences({
      dayOfMonth: 10,
      startDate: '2025-11-01',
      until: '2026-02-10',
    })

    expect(dates).toEqual(['2025-11-10', '2025-12-10', '2026-01-10', '2026-02-10'])
  })

  test('returns nothing when the start date is in the future', () => {
    const dates = dueOccurrences({
      dayOfMonth: 10,
      startDate: '2027-01-01',
      until: '2026-06-30',
    })

    expect(dates).toEqual([])
  })
})
