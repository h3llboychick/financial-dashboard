import { describe, expect, test } from '@jest/globals'
import { dueOccurrences, monthlyOccurrence, nextOccurrenceAfter, scheduleLabel } from '../src/modules/recurring/schedule.js'

function rule(overrides = {}) {
  return {
    frequency: 'monthly',
    interval_count: 1,
    day_of_month: 28,
    last_day: 0,
    weekday: null,
    month_of_year: null,
    start_date: '2026-01-01',
    ...overrides,
  }
}

describe('monthlyOccurrence', () => {
  test('clamps the day to the length of the month', () => {
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2026, month: 2 })).toBe('2026-02-28')
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2028, month: 2 })).toBe('2028-02-29')
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2026, month: 4 })).toBe('2026-04-30')
    expect(monthlyOccurrence({ dayOfMonth: 31, year: 2026, month: 1 })).toBe('2026-01-31')
  })

  test('pins to the last day when asked to', () => {
    expect(monthlyOccurrence({ dayOfMonth: 5, lastDay: true, year: 2026, month: 9 })).toBe('2026-09-30')
    expect(monthlyOccurrence({ dayOfMonth: 5, lastDay: true, year: 2026, month: 2 })).toBe('2026-02-28')
    expect(monthlyOccurrence({ dayOfMonth: 5, lastDay: true, year: 2028, month: 2 })).toBe('2028-02-29')
  })
})

describe('monthly rules', () => {
  test('fires on the chosen day every month', () => {
    expect(dueOccurrences({ rule: rule(), until: '2026-04-30' }))
      .toEqual(['2026-01-28', '2026-02-28', '2026-03-28', '2026-04-28'])
  })

  test('supports the last day of the month', () => {
    expect(dueOccurrences({ rule: rule({ day_of_month: 31, last_day: 1 }), until: '2026-06-15' }))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  test('supports a specific 30th, which is not the same as the last day', () => {
    expect(dueOccurrences({ rule: rule({ day_of_month: 30 }), until: '2026-04-30' }))
      .toEqual(['2026-01-30', '2026-02-28', '2026-03-30', '2026-04-30'])
  })

  test('keeps every other month anchored to the start month', () => {
    expect(dueOccurrences({ rule: rule({ interval_count: 2, day_of_month: 5 }), until: '2026-06-30' }))
      .toEqual(['2026-01-05', '2026-03-05', '2026-05-05'])
  })

  test('skips the month already generated', () => {
    expect(dueOccurrences({ rule: rule({ day_of_month: 5 }), after: '2026-03-05', until: '2026-05-31' }))
      .toEqual(['2026-04-05', '2026-05-05'])
  })

  test('waits for the day to arrive', () => {
    expect(dueOccurrences({ rule: rule(), after: '2026-05-28', until: '2026-06-27' })).toEqual([])
  })

  test('ignores the months before the start date', () => {
    expect(dueOccurrences({ rule: rule({ start_date: '2026-03-20', day_of_month: 5 }), until: '2026-05-31' }))
      .toEqual(['2026-04-05', '2026-05-05'])
  })

  test('caps how many missed occurrences it backfills', () => {
    expect(dueOccurrences({ rule: rule({ start_date: '2024-01-01', day_of_month: 1 }), until: '2026-06-01', limit: 3 }))
      .toEqual(['2024-01-01', '2024-02-01', '2024-03-01'])
  })

  test('walks across a year boundary', () => {
    expect(dueOccurrences({ rule: rule({ day_of_month: 10, start_date: '2025-11-01' }), until: '2026-02-10' }))
      .toEqual(['2025-11-10', '2025-12-10', '2026-01-10', '2026-02-10'])
  })

  test('returns nothing when the start date is in the future', () => {
    expect(dueOccurrences({ rule: rule({ start_date: '2027-01-01' }), until: '2026-06-30' })).toEqual([])
  })
})

describe('weekly rules', () => {
  test('fires every week on the chosen weekday', () => {
    // 2026-01-05 is a Monday
    expect(dueOccurrences({ rule: rule({ frequency: 'weekly', weekday: 1, start_date: '2026-01-05' }), until: '2026-01-26' }))
      .toEqual(['2026-01-05', '2026-01-12', '2026-01-19', '2026-01-26'])
  })

  test('waits for the first matching weekday after the start date', () => {
    // Monday rule, Tuesday start
    expect(dueOccurrences({ rule: rule({ frequency: 'weekly', weekday: 1, start_date: '2026-01-06' }), until: '2026-01-20' }))
      .toEqual(['2026-01-12', '2026-01-19'])
  })

  test('supports every other week', () => {
    // 2026-01-07 is a Wednesday
    expect(dueOccurrences({ rule: rule({ frequency: 'weekly', weekday: 3, start_date: '2026-01-07', interval_count: 2 }), until: '2026-02-11' }))
      .toEqual(['2026-01-07', '2026-01-21', '2026-02-04'])
  })
})

describe('daily rules', () => {
  test('fires every day', () => {
    expect(dueOccurrences({ rule: rule({ frequency: 'daily', start_date: '2026-02-26' }), until: '2026-03-02' }))
      .toEqual(['2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
  })

  test('supports a fixed day count such as every 30 days', () => {
    expect(dueOccurrences({ rule: rule({ frequency: 'daily', interval_count: 30, start_date: '2026-01-01' }), until: '2026-04-01' }))
      .toEqual(['2026-01-01', '2026-01-31', '2026-03-02', '2026-04-01'])
  })
})

describe('yearly rules', () => {
  test('fires once a year on the chosen month and day', () => {
    expect(dueOccurrences({ rule: rule({ frequency: 'yearly', month_of_year: 3, day_of_month: 15, start_date: '2024-01-01' }), until: '2026-12-31' }))
      .toEqual(['2024-03-15', '2025-03-15', '2026-03-15'])
  })

  test('clamps February 29 in a non-leap year', () => {
    expect(dueOccurrences({ rule: rule({ frequency: 'yearly', month_of_year: 2, day_of_month: 29, start_date: '2024-01-01' }), until: '2026-12-31' }))
      .toEqual(['2024-02-29', '2025-02-28', '2026-02-28'])
  })
})

describe('nextOccurrenceAfter', () => {
  test('returns the coming date', () => {
    expect(nextOccurrenceAfter(rule({ last_day: 1, day_of_month: 31 }), '2026-04-30')).toBe('2026-05-31')
  })

  test('returns null when the rule has no start date', () => {
    expect(nextOccurrenceAfter({ start_date: null }, '2026-04-30')).toBeNull()
  })
})

describe('scheduleLabel', () => {
  test('describes each frequency in words', () => {
    expect(scheduleLabel(rule({ day_of_month: 28 }))).toBe('Monthly on day 28')
    expect(scheduleLabel(rule({ day_of_month: 31, last_day: 1 }))).toBe('Monthly on the last day')
    expect(scheduleLabel(rule({ day_of_month: 1, interval_count: 3 }))).toBe('Every 3 months on day 1')
    expect(scheduleLabel(rule({ frequency: 'weekly', weekday: 1 }))).toBe('Every Monday')
    expect(scheduleLabel(rule({ frequency: 'weekly', weekday: 1, interval_count: 2 }))).toBe('Every 2 weeks on Monday')
    expect(scheduleLabel(rule({ frequency: 'daily' }))).toBe('Every day')
    expect(scheduleLabel(rule({ frequency: 'daily', interval_count: 30 }))).toBe('Every 30 days')
    expect(scheduleLabel(rule({ frequency: 'yearly', month_of_year: 3, day_of_month: 15 }))).toBe('Every year on day 15 of March')
  })
})
