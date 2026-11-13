import { describe, expect, test } from '@jest/globals'
import { wrappedWindow } from '../src/shared/wrapped/window.js'

const ZONE = 'Europe/Tallinn'

describe('wrapped window', () => {
  test('closed right before it opens', () => {
    const result = wrappedWindow(new Date('2026-12-14T21:59:00Z'), ZONE)

    expect(result.available).toBe(false)
    expect(result.year).toBe(2026)
  })

  test('open from midnight on 15 December', () => {
    const result = wrappedWindow(new Date('2026-12-14T22:00:00Z'), ZONE)

    expect(result.available).toBe(true)
    expect(result.year).toBe(2026)
    // 15 December 00:00 in Tallinn is 22:00 UTC the evening before
    expect(result.opens_at).toBe('2026-12-14T22:00:00.000Z')
  })

  test('still open late in the evening of 1 January, about the year that ended', () => {
    const result = wrappedWindow(new Date('2027-01-01T21:59:59Z'), ZONE)

    expect(result.available).toBe(true)
    expect(result.year).toBe(2026)
  })

  test('closed from 2 January', () => {
    const result = wrappedWindow(new Date('2027-01-01T22:00:00Z'), ZONE)

    expect(result.available).toBe(false)
    expect(result.year).toBe(2027)
  })

  test('closed the rest of the year', () => {
    for (const date of ['2026-01-05T10:00:00Z', '2026-06-15T10:00:00Z', '2026-12-02T10:00:00Z']) {
      expect(wrappedWindow(new Date(date), ZONE).available).toBe(false)
    }
  })

  test('reports the closing instant as the start of 2 January', () => {
    const result = wrappedWindow(new Date('2026-12-20T10:00:00Z'), ZONE)

    expect(result.closes_at).toBe('2027-01-01T22:00:00.000Z')
    expect(result.time_zone).toBe(ZONE)
  })
})
