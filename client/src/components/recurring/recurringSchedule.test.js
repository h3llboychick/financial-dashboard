import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule } from './recurringSchedule.js'

test('last day preset pins the rule to the end of the month', () => {
  assert.deepEqual(buildSchedule({ preset: 'last_day' }), {
    frequency: 'monthly',
    interval_count: 1,
    day_of_month: 31,
    last_day: true,
  })
})

test('day of month preset keeps a specific day', () => {
  assert.deepEqual(buildSchedule({ preset: 'month_day', day: 30 }), {
    frequency: 'monthly',
    interval_count: 1,
    day_of_month: 30,
    last_day: false,
  })
})

test('every N months preset keeps the interval', () => {
  assert.deepEqual(buildSchedule({ preset: 'every_n_months', day: 5, interval: 3 }), {
    frequency: 'monthly',
    interval_count: 3,
    day_of_month: 5,
    last_day: false,
  })
})

test('weekly preset carries the weekday', () => {
  assert.deepEqual(buildSchedule({ preset: 'weekly', weekday: 1 }), {
    frequency: 'weekly',
    interval_count: 1,
    weekday: 1,
  })
})

test('every N days preset carries the interval', () => {
  assert.deepEqual(buildSchedule({ preset: 'every_n_days', interval: 30 }), {
    frequency: 'daily',
    interval_count: 30,
  })
})

test('yearly preset carries month and day', () => {
  assert.deepEqual(buildSchedule({ preset: 'yearly', month: 3, day: 15 }), {
    frequency: 'yearly',
    interval_count: 1,
    month_of_year: 3,
    day_of_month: 15,
    last_day: false,
  })
})

test('clamps out of range numbers instead of sending them', () => {
  assert.equal(buildSchedule({ preset: 'month_day', day: 99 }).day_of_month, 31)
  assert.equal(buildSchedule({ preset: 'month_day', day: 0 }).day_of_month, 1)
  assert.equal(buildSchedule({ preset: 'every_n_days', interval: -5 }).interval_count, 1)
  assert.equal(buildSchedule({ preset: 'weekly', weekday: 9 }).weekday, 6)
})

test('rejects an unknown preset', () => {
  assert.throws(() => buildSchedule({ preset: 'nope' }), /Unknown preset/)
})
