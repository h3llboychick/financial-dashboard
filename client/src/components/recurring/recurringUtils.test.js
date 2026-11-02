import test from 'node:test'
import assert from 'node:assert/strict'
import { nextOccurrence } from './recurringUtils.js'

test('points at this month while the day is still ahead', () => {
  const next = nextOccurrence({ dayOfMonth: 28, today: new Date('2026-11-02T12:00:00Z') })

  assert.deepEqual(next, { date: '2026-11-28', monthName: 'Nov' })
})

test('points at this month when the day is today', () => {
  const next = nextOccurrence({ dayOfMonth: 2, today: new Date('2026-11-02T12:00:00Z') })

  assert.equal(next.date, '2026-11-02')
})

test('rolls to next month once the day has passed', () => {
  const next = nextOccurrence({ dayOfMonth: 1, today: new Date('2026-11-02T12:00:00Z') })

  assert.deepEqual(next, { date: '2026-12-01', monthName: 'Dec' })
})

test('rolls into the next year in december', () => {
  const next = nextOccurrence({ dayOfMonth: 1, today: new Date('2026-12-15T12:00:00Z') })

  assert.deepEqual(next, { date: '2027-01-01', monthName: 'Jan' })
})

test('clamps the 31st to the last day of a short month', () => {
  const next = nextOccurrence({ dayOfMonth: 31, today: new Date('2027-02-03T12:00:00Z') })

  assert.deepEqual(next, { date: '2027-02-28', monthName: 'Feb' })
})

test('returns null for a missing day', () => {
  assert.equal(nextOccurrence({ dayOfMonth: null, today: new Date('2026-11-02T12:00:00Z') }), null)
})
