import test from 'node:test'
import assert from 'node:assert/strict'
import { getRecentActivity } from './recentActivityData.js'

test('returns only entries from the selected month in newest-first order', () => {
  const entries = [
    { id: 1, date: '2026-08-02', created_at: '2026-08-02 08:00:00' },
    { id: 2, date: '2026-07-31', created_at: '2026-07-31 20:00:00' },
    { id: 3, date: '2026-08-20', created_at: '2026-08-20 09:00:00' },
  ]

  assert.deepEqual(getRecentActivity(entries, 2026, 8).map(entry => entry.id), [3, 1])
})

test('uses creation time and ID to order entries recorded on the same date', () => {
  const entries = [
    { id: 3, date: '2026-08-20', created_at: '2026-08-20 09:00:00' },
    { id: 1, date: '2026-08-20', created_at: '2026-08-20 08:00:00' },
    { id: 4, date: '2026-08-20', created_at: '2026-08-20 09:00:00' },
  ]

  assert.deepEqual(getRecentActivity(entries, 2026, 8).map(entry => entry.id), [4, 3, 1])
})

test('respects the requested limit without mutating the source list', () => {
  const entries = [
    { id: 1, date: '2026-08-01' },
    { id: 2, date: '2026-08-02' },
    { id: 3, date: '2026-08-03' },
  ]
  const originalOrder = entries.map(entry => entry.id)

  assert.deepEqual(getRecentActivity(entries, 2026, 8, 2).map(entry => entry.id), [3, 2])
  assert.deepEqual(entries.map(entry => entry.id), originalOrder)
})

test('returns an empty list when the selected month has no activity', () => {
  assert.deepEqual(getRecentActivity([{ id: 1, date: '2026-07-31' }], 2026, 8), [])
})
