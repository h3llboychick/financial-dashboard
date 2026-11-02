import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSchedule, scheduleFormFromRule } from './recurringSchedule.js'

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

test('restores the last day preset from a stored rule', () => {
  const form = scheduleFormFromRule({
    frequency: 'monthly',
    interval_count: 1,
    day_of_month: 31,
    last_day: 1,
  })

  assert.equal(form.preset, 'last_day')
  assert.equal(form.day, '31')
})

test('restores a specific day of the month', () => {
  const form = scheduleFormFromRule({ frequency: 'monthly', interval_count: 1, day_of_month: 30, last_day: 0 })

  assert.equal(form.preset, 'month_day')
  assert.equal(form.day, '30')
})

test('restores an every-N-months rule', () => {
  const form = scheduleFormFromRule({ frequency: 'monthly', interval_count: 3, day_of_month: 5, last_day: 0 })

  assert.deepEqual(
    { preset: form.preset, interval: form.interval, day: form.day },
    { preset: 'every_n_months', interval: 3, day: '5' },
  )
})

test('restores weekly, daily and yearly rules', () => {
  assert.equal(scheduleFormFromRule({ frequency: 'weekly', interval_count: 2, weekday: 3 }).preset, 'weekly')
  assert.equal(scheduleFormFromRule({ frequency: 'weekly', interval_count: 2, weekday: 3 }).weekday, '3')
  assert.equal(scheduleFormFromRule({ frequency: 'daily', interval_count: 30 }).preset, 'every_n_days')
  assert.equal(scheduleFormFromRule({ frequency: 'daily', interval_count: 30 }).interval, 30)
  assert.equal(scheduleFormFromRule({ frequency: 'yearly', month_of_year: 3, day_of_month: 15 }).preset, 'yearly')
  assert.equal(scheduleFormFromRule({ frequency: 'yearly', month_of_year: 3, day_of_month: 15 }).month, '3')
})

test('falls back to monthly when the rule has no frequency', () => {
  assert.equal(scheduleFormFromRule({ day_of_month: 12, last_day: 0 }).preset, 'month_day')
})
